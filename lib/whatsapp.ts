export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: Array<Record<string, any>>;
        statuses?: Array<Record<string, any>>;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
      };
    }>;
  }>;
};

export type StoredMessage = {
  external_message_id: string;
  timestamp: string;
  contact_phone: string;
  contact_name: string;
  direction: 'inbound';
  message_text: string;
  message_type: string;
  raw_payload: Record<string, any>;
  meta_phone_number_id: string | null;
};

export type RecentMessageRow = {
  id: string;
  timestamp: string;
  external_message_id?: string | null;
  contact_phone: string;
  contact_name: string | null;
  direction: string;
  message_text: string | null;
  message_type: string | null;
  meta_phone_number_id?: string | null;
  created_at?: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export function getConfigStatus() {
  return {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    phoneId: Boolean(process.env.WHATSAPP_PHONE_ID),
    whatsappToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    whatsappRecipient: Boolean(process.env.WHATSAPP_RECIPIENT_PHONE),
    openAiKey: Boolean(process.env.OPENAI_API_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };
}

export async function insertInboundMessages(messages: StoredMessage[]) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase configuration');
  }

  if (messages.length === 0) {
    return [];
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_messages?on_conflict=external_message_id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(messages),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed: ${errorText}`);
  }

  return (await response.json()) as Array<{ external_message_id: string }>;
}

export async function fetchRecentMessages(limit = 20) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase configuration');
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_messages?select=id,timestamp,external_message_id,contact_phone,contact_name,direction,message_text,message_type,meta_phone_number_id,created_at&order=timestamp.desc&limit=${limit}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase fetch failed: ${errorText}`);
  }

  return (await response.json()) as RecentMessageRow[];
}

export async function pingSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, error: 'Missing Supabase configuration' };
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_messages?select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return { ok: false, error: await response.text() };
  }

  return { ok: true as const };
}

export function extractInboundMessages(payload: WhatsAppWebhookPayload): StoredMessage[] {
  const records: StoredMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') {
        continue;
      }

      const value = change.value;
      const metadata = value?.metadata;
      const contacts = buildContactsMap(value?.contacts ?? []);

      for (const message of value?.messages ?? []) {
        if (!message?.id || !message?.from) {
          continue;
        }

        records.push({
          external_message_id: message.id,
          timestamp: toIsoTimestamp(message.timestamp),
          contact_phone: message.from,
          contact_name: contacts.get(message.from) ?? message.from,
          direction: 'inbound',
          message_text: extractMessageText(message),
          message_type: message.type ?? 'unknown',
          raw_payload: {
            object: payload.object ?? null,
            metadata: metadata ?? null,
            contact: contacts.get(message.from)
              ? {
                  wa_id: message.from,
                  profile_name: contacts.get(message.from),
                }
              : null,
            message,
          },
          meta_phone_number_id: metadata?.phone_number_id ?? null,
        });
      }
    }
  }

  return records;
}

export function countStatuses(payload: WhatsAppWebhookPayload) {
  return (payload.entry ?? []).reduce((total, entry) => {
    return (
      total +
      (entry.changes ?? []).reduce((changeTotal, change) => {
        return changeTotal + (change.value?.statuses?.length ?? 0);
      }, 0)
    );
  }, 0);
}

export function countWebhookMessages(payload: WhatsAppWebhookPayload) {
  return (payload.entry ?? []).reduce((total, entry) => {
    return (
      total +
      (entry.changes ?? []).reduce((changeTotal, change) => {
        return changeTotal + (change.value?.messages?.length ?? 0);
      }, 0)
    );
  }, 0);
}

export function createSamplePayload(input: {
  phone: string;
  name: string;
  text: string;
  phoneNumberId?: string;
}): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: {
                display_phone_number: 'sample',
                phone_number_id: input.phoneNumberId ?? process.env.WHATSAPP_PHONE_ID ?? 'sample',
              },
              contacts: [
                {
                  wa_id: input.phone,
                  profile: {
                    name: input.name,
                  },
                },
              ],
              messages: [
                {
                  id: `sample-${Date.now()}`,
                  from: input.phone,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: {
                    body: input.text,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildContactsMap(
  contacts: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>
) {
  const map = new Map<string, string>();

  for (const contact of contacts) {
    if (contact.wa_id) {
      map.set(contact.wa_id, contact.profile?.name || contact.wa_id);
    }
  }

  return map;
}

function extractMessageText(message: Record<string, any>) {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'image':
    case 'video':
    case 'document':
      return message[message.type]?.caption ?? '';
    case 'button':
      return message.button?.text ?? '';
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        ''
      );
    case 'location':
      return [message.location?.name, message.location?.address]
        .filter(Boolean)
        .join(' - ');
    default:
      return '';
  }
}

function toIsoTimestamp(timestamp: string | number | undefined) {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const numericTimestamp =
    typeof timestamp === 'string' ? Number(timestamp) : timestamp;

  if (Number.isFinite(numericTimestamp)) {
    return new Date(numericTimestamp * 1000).toISOString();
  }

  return new Date().toISOString();
}
