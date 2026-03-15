import { Composio } from '@composio/core';

import { getOrCreateToolIdentity } from '@/lib/tool-store';

const TOOLKIT_ALIASES: Record<string, string> = {
  drive: 'google_drive',
  google: 'google_drive',
  googledrive: 'google_drive',
};

let composioInstance: Composio | null = null;

export type ComposioConnectionStatus = {
  toolkit: string;
  isActive: boolean;
  connectedAccountId: string | null;
  authConfigId: string | null;
  status: string | null;
};

function getComposioApiKey() {
  return process.env.COMPOSIO_API_KEY?.trim() || '';
}

function getCallbackBaseUrl() {
  return (
    process.env.COMPOSIO_CALLBACK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    ''
  );
}

function normalizeToolkit(toolkit: string) {
  const normalized = String(toolkit || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  return TOOLKIT_ALIASES[normalized] || normalized;
}

function getClient() {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY is not set');
  }

  if (!composioInstance) {
    composioInstance = new Composio({
      apiKey,
      allowTracking: false,
    });
  }

  return composioInstance;
}

export async function getOrCreateComposioUserId(phone: string) {
  const identity = await getOrCreateToolIdentity(phone, 'operator');
  return identity.composio_user_id;
}

export async function getSessionForUser(phone: string, enabledToolkits: string[]) {
  const userId = await getOrCreateComposioUserId(phone);
  const toolkits = Array.from(
    new Set(enabledToolkits.map(normalizeToolkit).filter(Boolean))
  );

  const composio = getClient();
  return composio.create(userId, {
    toolkits: {
      enable: toolkits,
    },
  });
}

export async function listConnectedAccounts(phone: string, enabledToolkits: string[]) {
  const session = await getSessionForUser(phone, enabledToolkits);
  const response = await session.toolkits();

  return (response.items || []).map(
    (item): ComposioConnectionStatus => ({
      toolkit: item.slug,
      isActive: Boolean(item.connection?.isActive),
      connectedAccountId: item.connection?.connectedAccount?.id || null,
      authConfigId: item.connection?.authConfig?.id || null,
      status: item.connection?.connectedAccount?.status || null,
    })
  );
}

export async function checkConnection(
  phone: string,
  toolkit: string,
  enabledToolkits: string[]
) {
  const normalizedToolkit = normalizeToolkit(toolkit);
  const accounts = await listConnectedAccounts(phone, enabledToolkits);
  return (
    accounts.find((account) => normalizeToolkit(account.toolkit) === normalizedToolkit) || {
      toolkit: normalizedToolkit,
      isActive: false,
      connectedAccountId: null,
      authConfigId: null,
      status: null,
    }
  );
}

export async function startConnectLink(params: {
  phone: string;
  toolkit: string;
  enabledToolkits: string[];
}) {
  const normalizedToolkit = normalizeToolkit(params.toolkit);
  const session = await getSessionForUser(params.phone, params.enabledToolkits);
  const callbackBaseUrl = getCallbackBaseUrl();
  const callbackUrl = callbackBaseUrl
    ? `${callbackBaseUrl.replace(/\/$/, '')}/settings?tab=toolkits`
    : undefined;

  const connectionRequest = await session.authorize(normalizedToolkit, {
    callbackUrl,
  });

  return {
    toolkit: normalizedToolkit,
    connectedAccountId:
      (connectionRequest as { connectedAccountId?: string; id?: string }).connectedAccountId ||
      (connectionRequest as { connectedAccountId?: string; id?: string }).id ||
      null,
    redirectUrl: connectionRequest.redirectUrl || null,
    status: connectionRequest.status,
  };
}

export async function searchTools(params: {
  phone: string;
  intent: string;
  enabledToolkits: string[];
  toolkits?: string[];
}) {
  const session = await getSessionForUser(params.phone, params.enabledToolkits);
  const response = await session.search({
    query: params.intent,
    toolkits: params.toolkits?.map(normalizeToolkit).filter(Boolean),
  });

  return response.results || [];
}

export async function getToolSchema(toolSlug: string) {
  const composio = getClient();
  const tool = await composio.tools.getRawComposioToolBySlug(toolSlug);
  const toolkitSlug =
    ((tool as { toolkit?: { slug?: string } | string }).toolkit &&
    typeof (tool as { toolkit?: { slug?: string } | string }).toolkit === 'object'
      ? ((tool as { toolkit?: { slug?: string } }).toolkit?.slug || '')
      : ((tool as { toolkit?: string }).toolkit || '')) || '';

  return {
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    toolkitSlug,
    inputParameters: tool.inputParameters || {},
  };
}

export async function executeTool(params: {
  phone: string;
  toolSlug: string;
  arguments_: Record<string, unknown>;
  enabledToolkits: string[];
}) {
  const session = await getSessionForUser(params.phone, params.enabledToolkits);
  return session.execute(params.toolSlug, params.arguments_);
}

export async function disconnectToolkit(params: {
  phone: string;
  toolkit: string;
  enabledToolkits: string[];
}) {
  const connection = await checkConnection(params.phone, params.toolkit, params.enabledToolkits);
  if (!connection.connectedAccountId) {
    return { disconnected: false, reason: 'No connected account found for this toolkit.' };
  }

  const composio = getClient();
  await composio.connectedAccounts.disable(connection.connectedAccountId);

  return {
    disconnected: true,
    connectedAccountId: connection.connectedAccountId,
  };
}

export function isWriteLikeTool(toolSlug: string) {
  const upper = toolSlug.toUpperCase();
  return [
    'CREATE',
    'UPDATE',
    'DELETE',
    'SEND',
    'MERGE',
    'POST',
    'UPLOAD',
    'WRITE',
    'SHARE',
    'INVITE',
    'TRIGGER',
  ].some((verb) => upper.includes(verb));
}

export function sanitizeComposioError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/401|invalid api key|unauthorized/i.test(message)) {
    return 'Composio request failed: COMPOSIO_API_KEY is missing or invalid.';
  }

  if (/timeout/i.test(message)) {
    return 'Composio request timed out before the tool finished.';
  }

  if (/permission|forbidden|403/i.test(message)) {
    return 'The connected account does not have permission to run that action.';
  }

  return message.replace(/\s+/g, ' ').trim();
}
