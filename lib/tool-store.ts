import { readSupabaseError, supabaseFetch, supabaseJson } from '@/lib/supabase-rest';

export type ToolIdentityRow = {
  id: string;
  phone: string;
  composio_user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
};

export type ToolConnectionRow = {
  id: string;
  phone: string;
  toolkit: string;
  connected_account_id: string | null;
  status: string;
  auth_config_id: string | null;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ToolRunRow = {
  id: string;
  requester_phone: string;
  toolkit: string;
  tool_slug: string;
  arguments_summary: string | null;
  result_summary: string | null;
  status: string;
  approval_state: string;
  duration_ms: number | null;
  created_at: string;
};

export type ToolApprovalRow = {
  id: string;
  requester_phone: string;
  toolkit: string;
  tool_slug: string;
  action_title: string;
  arguments_json: Record<string, unknown>;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ToolAuthSessionRow = {
  id: string;
  requester_phone: string;
  toolkit: string;
  composio_user_id: string;
  redirect_url: string | null;
  callback_context: Record<string, unknown>;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function getOrCreateToolIdentity(phone: string, role = 'operator') {
  const escapedPhone = encodeURIComponent(phone);
  const existing = await supabaseJson<ToolIdentityRow[]>(
    `/rest/v1/tool_identities?phone=eq.${escapedPhone}&select=*`
  );

  if (existing[0]) {
    return existing[0];
  }

  const composioUserId = `wa_${phone.replace(/\D+/g, '') || phone}`;
  const response = await supabaseFetch('/rest/v1/tool_identities', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      phone,
      composio_user_id: composioUserId,
      role,
      updated_at: nowIso(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolIdentityRow[];
  return rows[0];
}

export async function upsertToolConnection(input: {
  phone: string;
  toolkit: string;
  connectedAccountId?: string | null;
  status: string;
  authConfigId?: string | null;
  lastVerifiedAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await supabaseFetch('/rest/v1/tool_connections', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      phone: input.phone,
      toolkit: input.toolkit,
      connected_account_id: input.connectedAccountId ?? null,
      status: input.status,
      auth_config_id: input.authConfigId ?? null,
      last_verified_at: input.lastVerifiedAt ?? null,
      metadata: input.metadata ?? {},
      updated_at: nowIso(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolConnectionRow[];
  return rows[0];
}

export async function logToolRun(input: {
  requesterPhone: string;
  toolkit: string;
  toolSlug: string;
  status: string;
  approvalState?: string;
  argumentsSummary?: string | null;
  resultSummary?: string | null;
  durationMs?: number | null;
}) {
  const response = await supabaseFetch('/rest/v1/tool_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      requester_phone: input.requesterPhone,
      toolkit: input.toolkit,
      tool_slug: input.toolSlug,
      status: input.status,
      approval_state: input.approvalState ?? 'not_required',
      arguments_summary: input.argumentsSummary ?? null,
      result_summary: input.resultSummary ?? null,
      duration_ms: input.durationMs ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolRunRow[];
  return rows[0];
}

export async function createToolApproval(input: {
  requesterPhone: string;
  toolkit: string;
  toolSlug: string;
  actionTitle: string;
  argumentsJson: Record<string, unknown>;
  expiresInMinutes?: number;
}) {
  const response = await supabaseFetch('/rest/v1/tool_approvals', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      requester_phone: input.requesterPhone,
      toolkit: input.toolkit,
      tool_slug: input.toolSlug,
      action_title: input.actionTitle,
      arguments_json: input.argumentsJson,
      status: 'pending',
      expires_at: minutesFromNow(input.expiresInMinutes ?? 30),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolApprovalRow[];
  return rows[0];
}

export async function getPendingApproval(phone: string) {
  const rows = await supabaseJson<ToolApprovalRow[]>(
    `/rest/v1/tool_approvals?requester_phone=eq.${encodeURIComponent(
      phone
    )}&status=eq.pending&order=created_at.desc&limit=1&select=*`
  );

  return rows.find((row) => new Date(row.expires_at).getTime() > Date.now()) || null;
}

export async function resolveToolApproval(id: string, status: 'approved' | 'expired' | 'rejected') {
  const response = await supabaseFetch(`/rest/v1/tool_approvals?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status,
      updated_at: nowIso(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolApprovalRow[];
  return rows[0] || null;
}

export async function createToolAuthSession(input: {
  requesterPhone: string;
  toolkit: string;
  composioUserId: string;
  redirectUrl?: string | null;
  callbackContext: Record<string, unknown>;
  expiresInMinutes?: number;
}) {
  const response = await supabaseFetch('/rest/v1/tool_auth_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      requester_phone: input.requesterPhone,
      toolkit: input.toolkit,
      composio_user_id: input.composioUserId,
      redirect_url: input.redirectUrl ?? null,
      callback_context: input.callbackContext,
      status: 'pending',
      expires_at: minutesFromNow(input.expiresInMinutes ?? 30),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolAuthSessionRow[];
  return rows[0];
}

export async function getPendingAuthSession(phone: string) {
  const rows = await supabaseJson<ToolAuthSessionRow[]>(
    `/rest/v1/tool_auth_sessions?requester_phone=eq.${encodeURIComponent(
      phone
    )}&status=eq.pending&order=created_at.desc&limit=1&select=*`
  );

  return rows.find((row) => new Date(row.expires_at).getTime() > Date.now()) || null;
}

export async function resolveToolAuthSession(id: string, status: 'connected' | 'expired' | 'abandoned') {
  const response = await supabaseFetch(`/rest/v1/tool_auth_sessions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status,
      updated_at: nowIso(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }

  const rows = (await response.json()) as ToolAuthSessionRow[];
  return rows[0] || null;
}

export async function fetchRecentToolRuns(limit = 20) {
  return supabaseJson<ToolRunRow[]>(
    `/rest/v1/tool_runs?select=*&order=created_at.desc&limit=${limit}`
  );
}
