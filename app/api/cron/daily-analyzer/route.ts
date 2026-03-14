import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT_PHONE;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || '';
}

function sanitizeProviderMessage(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/api key provided:[^.,\n]*/gi, 'API key provided: [redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('[Cron] Starting daily analysis');
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_messages?timestamp=gte.${yesterday}&order=timestamp.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY!,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    const messages = await response.json();
    console.log(`[Cron] Found ${messages.length} messages`);
    
    if (messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' });
    }
    
    const transcript = messages.map((m: any) => 
      `[${m.timestamp}] ${m.contact_name}: ${m.message_text}`
    ).join('\n\n');
    
    const openAiApiKey = getOpenAiApiKey();
    if (!openAiApiKey) {
      throw new Error('Daily analyzer OpenAI request failed: OPENAI_API_KEY is not set.');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{
          role: 'system',
          content: 'Analyze WhatsApp messages and return JSON with: urgent_responses[], high_priority_followups[], tasks_to_complete[], people_to_contact[], summary, total_messages_analyzed.'
        }, {
          role: 'user',
          content: `Analyze:\n${transcript}`
        }],
        response_format: { type: 'json_object' }
      })
    });
    
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      const providerMessage =
        typeof aiData?.error?.message === 'string'
          ? sanitizeProviderMessage(aiData.error.message)
          : aiResponse.statusText;
      throw new Error(`Daily analyzer OpenAI request failed: ${providerMessage}`);
    }
    const plan = JSON.parse(aiData.choices[0].message.content);
    
    await fetch(`${SUPABASE_URL}/rest/v1/daily_action_plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        plan_date: new Date().toISOString().split('T')[0],
        summary: plan.summary,
        action_items: plan,
        urgent_count: plan.urgent_responses?.length || 0,
        tasks_count: plan.tasks_to_complete?.length || 0,
        total_messages: messages.length
      })
    });
    
    if (WHATSAPP_RECIPIENT && WHATSAPP_PHONE_ID && WHATSAPP_TOKEN) {
      const digest = formatDigest(plan, messages.length);
      await sendWhatsApp(digest);
    }
    
    return NextResponse.json({
      status: 'success',
      analyzed: messages.length,
      urgent: plan.urgent_responses?.length || 0
    });
    
  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatDigest(plan: any, count: number): string {
  let text = `📊 *Daily WhatsApp Action Plan*\n\n`;
  text += `📅 ${new Date().toLocaleDateString()}\n`;
  text += `📨 Messages: ${count}\n\n`;
  
  const urgent = plan.urgent_responses || [];
  if (urgent.length > 0) {
    text += `🚨 *URGENT (${urgent.length}):*\n`;
    urgent.slice(0, 3).forEach((u: any) => {
      text += `• ${u.person}: ${u.action_needed}\n`;
    });
    text += '\n';
  }
  
  const tasks = plan.tasks_to_complete || [];
  if (tasks.length > 0) {
    text += `✅ *TASKS (${tasks.length}):*\n`;
    tasks.slice(0, 3).forEach((t: any) => {
      text += `• ${t.task}\n`;
    });
    text += '\n';
  }
  
  text += `📝 *Summary:*\n${plan.summary}`;
  
  return text;
}

async function sendWhatsApp(message: string) {
  await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: process.env.WHATSAPP_RECIPIENT_PHONE,
        type: 'text',
        text: { body: message }
      })
    }
  );
}
