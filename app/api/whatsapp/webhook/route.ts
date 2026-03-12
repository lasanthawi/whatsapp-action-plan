import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

type WhatsAppWebhookPayload = {
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

type StoredMessage = {
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

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (!WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json(
      { error: 'Missing WHATSAPP_VERIFY_TOKEN' },
      { status: 500 }
    );
  }

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase configuration' },
      { status: 500 }
    );
  }

  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;

    console.log('[Webhook] Received WhatsApp event');

    const messages = extractInboundMessages(payload);

    if (messages.length === 0) {
      const statusCount = countStatuses(payload);
      return NextResponse.json({
        status: 'ok',
        message: 'No inbound messages to store',
        statuses: statusCount,
      });
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
      console.error('[Webhook] Database error:', errorText);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const insertedRows = (await response.json()) as Array<{ external_message_id: string }>;

    console.log(`[Webhook] Stored ${insertedRows.length} WhatsApp messages`);

    return NextResponse.json({
      status: 'success',
      stored: insertedRows.length,
      messageIds: insertedRows.map((row) => row.external_message_id),
    });
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function extractInboundMessages(payload: WhatsAppWebhookPayload): StoredMessage[] {
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

function countStatuses(payload: WhatsAppWebhookPayload) {
  return (payload.entry ?? []).reduce((total, entry) => {
    return (
      total +
      (entry.changes ?? []).reduce((changeTotal, change) => {
        return changeTotal + (change.value?.statuses?.length ?? 0);
      }, 0)
    );
  }, 0);
}
