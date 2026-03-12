import { NextRequest, NextResponse } from 'next/server';

import {
  createSamplePayload,
  extractInboundMessages,
  insertInboundMessages,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = createSamplePayload({
      phone: body.phone || '94770000000',
      name: body.name || 'Dashboard Test',
      text: body.text || 'This is a dashboard test message.',
      phoneNumberId: body.phoneNumberId,
    });

    const messages = extractInboundMessages(payload);
    const insertedRows = await insertInboundMessages(messages);

    return NextResponse.json({
      status: 'success',
      stored: insertedRows.length,
      messageIds: insertedRows.map((row) => row.external_message_id),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
