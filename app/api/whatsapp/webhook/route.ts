import { NextRequest, NextResponse } from 'next/server';

import {
  countStatuses,
  countWebhookMessages,
  extractInboundMessages,
  insertInboundMessages,
  type WhatsAppWebhookPayload,
} from '@/lib/whatsapp';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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
  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;

    console.log('[Webhook] Received WhatsApp event');

    const messages = extractInboundMessages(payload);
    const statusCount = countStatuses(payload);
    const messageCount = countWebhookMessages(payload);

    console.log(
      `[Webhook] Payload summary: messages=${messageCount}, statuses=${statusCount}, extracted=${messages.length}`
    );

    if (messages.length === 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'No inbound messages to store',
        statuses: statusCount,
        payloadMessages: messageCount,
      });
    }

    const insertedRows = await insertInboundMessages(messages);

    console.log(`[Webhook] Stored ${insertedRows.length} WhatsApp messages`);

    return NextResponse.json({
      status: 'success',
      stored: insertedRows.length,
      statuses: statusCount,
      payloadMessages: messageCount,
      messageIds: insertedRows.map((row) => row.external_message_id),
    });
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
