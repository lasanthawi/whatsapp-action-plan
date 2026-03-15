/**
 * App settings storage (Supabase key-value).
 * Run schema.sql to create app_settings table if needed.
 */

import { supabaseFetch } from '@/lib/supabase-rest';

export type WhatsAppProfileSettings = {
  profilePictureUrl: string;
  description: string;
  email: string;
  address: string;
  website: string;
};

export type AgentCapabilitiesSettings = {
  neonDbMessages: boolean;
  github: boolean;
  facebook: boolean;
  linkedin: boolean;
  drive: boolean;
  composioTools: boolean;
  autoReplyMode: boolean;
};

export type AutomatedTasksSettings = {
  dailyReports: boolean;
  actionPlans: boolean;
};

export type ComposioSettings = {
  composioEnabled: boolean;
  composioApiKeyPresent: boolean;
  operatorPhoneAllowlist: string[];
  enabledToolkits: string[];
  toolExecutionMode: 'operator_only';
  approvalRequiredActions: string[];
  defaultToolTimeoutMs: number;
  toolResultVerbosity: 'brief' | 'detailed';
  autoExecuteReads: boolean;
};

export type AppSettings = {
  whatsappProfile: WhatsAppProfileSettings;
  agentCapabilities: AgentCapabilitiesSettings;
  automatedTasks: AutomatedTasksSettings;
  composio: ComposioSettings;
};

const DEFAULT_WHATSAPP_PROFILE: WhatsAppProfileSettings = {
  profilePictureUrl: '',
  description: '',
  email: '',
  address: '',
  website: '',
};

const DEFAULT_AGENT_CAPABILITIES: AgentCapabilitiesSettings = {
  neonDbMessages: true,
  github: false,
  facebook: false,
  linkedin: false,
  drive: false,
  composioTools: false,
  autoReplyMode: true,
};

const DEFAULT_AUTOMATED_TASKS: AutomatedTasksSettings = {
  dailyReports: true,
  actionPlans: true,
};

const DEFAULT_COMPOSIO_SETTINGS: ComposioSettings = {
  composioEnabled: false,
  composioApiKeyPresent: Boolean(process.env.COMPOSIO_API_KEY),
  operatorPhoneAllowlist: [],
  enabledToolkits: ['github', 'google_drive', 'gmail', 'slack', 'calendar'],
  toolExecutionMode: 'operator_only',
  approvalRequiredActions: ['merge', 'send', 'create', 'update', 'delete', 'share'],
  defaultToolTimeoutMs: 30000,
  toolResultVerbosity: 'brief',
  autoExecuteReads: true,
};

const KEYS = {
  whatsappProfile: 'whatsapp_profile',
  agentCapabilities: 'agent_capabilities',
  automatedTasks: 'automated_tasks',
  composio: 'composio_settings',
} as const;

async function getSetting<K>(key: string): Promise<K | null> {
  try {
    const res = await supabaseFetch(
      `/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ value: K }>;
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: unknown): Promise<void> {
  const res = await supabaseFetch('/rest/v1/app_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      key,
      value: value as object,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const isTableMissing =
      res.status === 404 ||
      /PGRST205|Could not find the table.*app_settings/i.test(text);
    if (isTableMissing) {
      throw new Error(
        'The app_settings table does not exist in Supabase. Run the SQL in supabase-app_settings.sql (or schema.sql) in your Supabase project: SQL Editor → New query → paste and run.'
      );
    }
    throw new Error(`Failed to save settings: ${text}`);
  }
}

export async function getWhatsAppProfile(): Promise<WhatsAppProfileSettings> {
  const stored = await getSetting<WhatsAppProfileSettings>(KEYS.whatsappProfile);
  return stored ? { ...DEFAULT_WHATSAPP_PROFILE, ...stored } : DEFAULT_WHATSAPP_PROFILE;
}

export async function getAgentCapabilities(): Promise<AgentCapabilitiesSettings> {
  const stored = await getSetting<AgentCapabilitiesSettings>(KEYS.agentCapabilities);
  return stored ? { ...DEFAULT_AGENT_CAPABILITIES, ...stored } : DEFAULT_AGENT_CAPABILITIES;
}

export async function getAutomatedTasks(): Promise<AutomatedTasksSettings> {
  const stored = await getSetting<AutomatedTasksSettings>(KEYS.automatedTasks);
  return stored ? { ...DEFAULT_AUTOMATED_TASKS, ...stored } : DEFAULT_AUTOMATED_TASKS;
}

export async function getComposioSettings(): Promise<ComposioSettings> {
  const stored = await getSetting<ComposioSettings>(KEYS.composio);
  const settings = stored ? { ...DEFAULT_COMPOSIO_SETTINGS, ...stored } : DEFAULT_COMPOSIO_SETTINGS;
  settings.composioApiKeyPresent = Boolean(process.env.COMPOSIO_API_KEY);
  settings.operatorPhoneAllowlist = normalizeStringArray(settings.operatorPhoneAllowlist);
  settings.enabledToolkits = normalizeStringArray(settings.enabledToolkits);
  settings.approvalRequiredActions = normalizeStringArray(settings.approvalRequiredActions);
  return settings;
}

export async function getAllSettings(): Promise<AppSettings> {
  const [whatsappProfile, agentCapabilities, automatedTasks, composio] = await Promise.all([
    getWhatsAppProfile(),
    getAgentCapabilities(),
    getAutomatedTasks(),
    getComposioSettings(),
  ]);
  return { whatsappProfile, agentCapabilities, automatedTasks, composio };
}

export async function saveWhatsAppProfile(data: Partial<WhatsAppProfileSettings>): Promise<void> {
  const current = await getWhatsAppProfile();
  await setSetting(KEYS.whatsappProfile, { ...current, ...data });
}

export async function saveAgentCapabilities(data: Partial<AgentCapabilitiesSettings>): Promise<void> {
  const current = await getAgentCapabilities();
  await setSetting(KEYS.agentCapabilities, { ...current, ...data });
}

export async function saveAutomatedTasks(data: Partial<AutomatedTasksSettings>): Promise<void> {
  const current = await getAutomatedTasks();
  await setSetting(KEYS.automatedTasks, { ...current, ...data });
}

export async function saveComposioSettings(data: Partial<ComposioSettings>): Promise<void> {
  const current = await getComposioSettings();
  await setSetting(KEYS.composio, {
    ...current,
    ...data,
    composioApiKeyPresent: Boolean(process.env.COMPOSIO_API_KEY),
    operatorPhoneAllowlist: normalizeStringArray(data.operatorPhoneAllowlist ?? current.operatorPhoneAllowlist),
    enabledToolkits: normalizeStringArray(data.enabledToolkits ?? current.enabledToolkits),
    approvalRequiredActions: normalizeStringArray(
      data.approvalRequiredActions ?? current.approvalRequiredActions
    ),
  });
}

function normalizeStringArray(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}
