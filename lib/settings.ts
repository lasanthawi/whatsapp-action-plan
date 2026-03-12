/**
 * App settings storage (Supabase key-value).
 * Run schema.sql to create app_settings table if needed.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

export type AppSettings = {
  whatsappProfile: WhatsAppProfileSettings;
  agentCapabilities: AgentCapabilitiesSettings;
  automatedTasks: AutomatedTasksSettings;
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

const KEYS = {
  whatsappProfile: 'whatsapp_profile',
  agentCapabilities: 'agent_capabilities',
  automatedTasks: 'automated_tasks',
} as const;

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase configuration');
  }
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  return response;
}

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

export async function getAllSettings(): Promise<AppSettings> {
  const [whatsappProfile, agentCapabilities, automatedTasks] = await Promise.all([
    getWhatsAppProfile(),
    getAgentCapabilities(),
    getAutomatedTasks(),
  ]);
  return { whatsappProfile, agentCapabilities, automatedTasks };
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
