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
  direction: 'inbound' | 'outbound';
  message_text: string;
  message_type: string;
  raw_payload: Record<string, any>;
  meta_phone_number_id: string | null;
};

export type MessageRow = {
  id: string;
  timestamp: string;
  external_message_id?: string | null;
  contact_phone: string;
  contact_name: string | null;
  direction: 'inbound' | 'outbound';
  message_text: string | null;
  message_type: string | null;
  meta_phone_number_id?: string | null;
  created_at?: string | null;
};

export type ConversationSummary = {
  contact_phone: string;
  contact_name: string;
  last_message_text: string;
  last_message_at: string;
  last_direction: 'inbound' | 'outbound';
  message_count: number;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

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
  neonAuthBaseUrl: Boolean(process.env.NEON_AUTH_BASE_URL),
  neonAuthCookieSecret: Boolean(process.env.NEON_AUTH_COOKIE_SECRET),
  agentEnabled: (() => {
    if (!process.env.OPENAI_API_KEY) return false;
    const env = process.env.ENABLE_AUTO_REPLY_AGENT;
    if (env === 'false' || env === '0' || env === 'no') return false;
    return true;
  })(),
};
}

export async function insertInboundMessages(messages: StoredMessage[]) {
  if (messages.length === 0) {
    return [];
  }

  return insertMessages(messages);
}

export async function fetchRecentMessages(limit = 20) {
  const response = await supabaseFetch(
    `/rest/v1/whatsapp_messages?select=id,timestamp,external_message_id,contact_phone,contact_name,direction,message_text,message_type,meta_phone_number_id,created_at&order=timestamp.desc&limit=${limit}`
  );

  return (await response.json()) as MessageRow[];
}

export async function fetchMessagesByPhone(contactPhone: string, limit = 100) {
  const response = await supabaseFetch(
    `/rest/v1/whatsapp_messages?select=id,timestamp,external_message_id,contact_phone,contact_name,direction,message_text,message_type,meta_phone_number_id,created_at&contact_phone=eq.${encodeURIComponent(
      contactPhone
    )}&order=timestamp.asc&limit=${limit}`
  );

  return (await response.json()) as MessageRow[];
}

export async function fetchConversationSummaries(limit = 200) {
  const messages = await fetchRecentMessages(limit);
  const grouped = new Map<string, ConversationSummary>();

  for (const message of messages) {
    const existing = grouped.get(message.contact_phone);

    if (!existing) {
      grouped.set(message.contact_phone, {
        contact_phone: message.contact_phone,
        contact_name: message.contact_name || message.contact_phone,
        last_message_text: message.message_text || '',
        last_message_at: message.timestamp,
        last_direction: message.direction,
        message_count: 1,
      });
      continue;
    }

    existing.message_count += 1;

    if (new Date(message.timestamp).getTime() > new Date(existing.last_message_at).getTime()) {
      existing.last_message_at = message.timestamp;
      existing.last_message_text = message.message_text || '';
      existing.last_direction = message.direction;
      existing.contact_name = message.contact_name || existing.contact_name;
    }
  }

  return Array.from(grouped.values()).sort(
    (left, right) =>
      new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime()
  );
}

export async function pingSupabase() {
  try {
    await supabaseFetch('/rest/v1/whatsapp_messages?select=id&limit=1');
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, error: error.message };
  }
}

export async function sendTextReply(input: {
  to: string;
  body: string;
  contactName?: string | null;
}) {
  if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
    throw new Error('Missing WhatsApp sending configuration');
  }

  const sendResponse = await fetch(
    `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.to,
        type: 'text',
        text: {
          preview_url: false,
          body: input.body,
        },
      }),
    }
  );

  const sendPayload = await safeJson(sendResponse);

  if (!sendResponse.ok) {
    throw new Error(formatWhatsAppError(sendPayload));
  }

  const externalMessageId =
    sendPayload.messages?.[0]?.id ?? `outbound-${Date.now()}`;

  const stored = await insertMessages([
    {
      external_message_id: externalMessageId,
      timestamp: new Date().toISOString(),
      contact_phone: input.to,
      contact_name: input.contactName || input.to,
      direction: 'outbound',
      message_text: input.body,
      message_type: 'text',
      raw_payload: sendPayload,
      meta_phone_number_id: WHATSAPP_PHONE_ID,
    },
  ]);

  return {
    externalMessageId,
    storedCount: stored.length,
    raw: sendPayload,
  };
}

function formatWhatsAppError(payload: any) {
  const graphError = payload?.error;

  if (!graphError) {
    return 'Reply failed. WhatsApp returned an unknown error.';
  }

  const message =
    typeof graphError.message === 'string' ? graphError.message : '';
  const code = graphError.code;

  if (code === 10 || /permission for this action/i.test(message)) {
    return [
      'Reply failed: Application does not have permission (Meta error #10).',
      'Grant the app permission to send messages:',
      '1. Meta for Developers → Your App → App Dashboard.',
      '2. Add/request permissions: whatsapp_business_management, whatsapp_business_messaging.',
      '3. Business Settings → Users → System Users → Generate token for your app with those permissions.',
      '4. Use that token as WHATSAPP_ACCESS_TOKEN. In development, add recipient as test number in WhatsApp → API Setup.',
    ].join(' ');
  }

  if (/access token/i.test(message) && /expired/i.test(message)) {
    return 'Reply failed: your WhatsApp access token has expired. Generate a new token in Meta and update WHATSAPP_ACCESS_TOKEN in Vercel.';
  }

  if (/24-hour|outside the allowed window|customer care window/i.test(message)) {
    return 'Reply failed: this chat is outside the WhatsApp customer care window. Use an approved template message or wait for the user to message you again.';
  }

  if (/recipient/i.test(message) && /not/i.test(message)) {
    return 'Reply failed: Meta rejected the recipient phone number. Check the phone number format and your WhatsApp setup.';
  }

  if (message) {
    return `Reply failed: ${message}`;
  }

  return 'Reply failed. WhatsApp rejected the message.';
}

async function safeJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

async function insertMessages(messages: StoredMessage[]) {
  const response = await supabaseFetch('/rest/v1/whatsapp_messages?on_conflict=external_message_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(messages),
  });

  return (await response.json()) as Array<{ external_message_id: string }>;
}

async function supabaseFetch(path: string, init?: RequestInit) {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase fetch failed: ${errorText}`);
  }

  return response;
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
      return message.image?.caption?.trim() || '[Image received]';
    case 'video':
      return message.video?.caption?.trim() || '[Video received]';
    case 'document':
      return (
        message.document?.caption?.trim() ||
        (message.document?.filename
          ? `[Document received: ${message.document.filename}]`
          : '[Document received]')
      );
    case 'audio':
      return message.audio?.voice ? '[Voice note received]' : '[Audio message received]';
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
    case 'sticker':
      return '[Sticker received]';
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
