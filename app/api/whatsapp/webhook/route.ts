import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    console.log('[Webhook] Received WhatsApp event');
    
    const messageData = extractMessageData(payload);
    
    if (!messageData) {
      return NextResponse.json({ status: 'ok', message: 'No message data' });
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        timestamp: messageData.timestamp,
        contact_phone: messageData.phone,
        contact_name: messageData.name,
        direction: messageData.direction,
        message_text: messageData.text,
        message_type: messageData.type,
        raw_payload: payload
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Webhook] Database error:', errorText);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    console.log(`[Webhook] Stored: ${messageData.name} (${messageData.phone})`);
    
    return NextResponse.json({ 
      status: 'success',
      contact: messageData.name
    });
    
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function extractMessageData(payload: any) {
  try {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    
    if (!message) return null;
    
    return {
      phone: message.from || 'unknown',
      name: contact?.profile?.name || message.from || 'Unknown',
      text: message.text?.body || message.caption || '',
      type: message.type || 'text',
      direction: 'inbound',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Extract] Error:', error);
    return null;
  }
}