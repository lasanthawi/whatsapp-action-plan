import { NextRequest, NextResponse } from 'next/server';

import {
  buildConversationTurns,
  getAgentDisabledReason,
  type AgentCapabilitiesContext,
  type BusinessProfileContext,
} from '@/lib/chat-agent';
import { generateOperatorAwareReply } from '@/lib/operator-agent';
import {
  getAgentCapabilities,
  getComposioSettings,
  getWhatsAppProfile,
  type ComposioSettings,
} from '@/lib/settings';
import {
  countStatuses,
  countWebhookMessages,
  extractInboundMessages,
  fetchMessagesByPhone,
  insertInboundMessages,
  sendTextReply,
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

    const autoReplied: string[] = [];
    let agentError: string | undefined;
    let capabilities: AgentCapabilitiesContext | undefined;
    let businessProfile: BusinessProfileContext | undefined;
    let composioSettings: ComposioSettings | undefined;

    try {
      const [capabilitySettings, profileSettings, composioSettingsResult] = await Promise.all([
        getAgentCapabilities(),
        getWhatsAppProfile(),
        getComposioSettings(),
      ]);
      capabilities = capabilitySettings;
      businessProfile = profileSettings;
      composioSettings = composioSettingsResult;
    } catch (settingsError: unknown) {
      const msg =
        settingsError instanceof Error
          ? settingsError.message
          : String(settingsError);
      console.warn('[Webhook] Failed loading settings, using defaults:', msg);
    }

    const settingsDisabledReason =
      capabilities && !capabilities.autoReplyMode
        ? 'autoReplyMode is disabled in settings'
        : null;
    const disabledReason = getAgentDisabledReason() ?? settingsDisabledReason;
    if (disabledReason) {
      console.log(`[Webhook] Auto-reply agent skipped: ${disabledReason}`);
    } else if (messages.length > 0) {
      const byContact = new Map<string, typeof messages>();
      for (const m of messages) {
        const existing = byContact.get(m.contact_phone);
        if (!existing) {
          byContact.set(m.contact_phone, [m]);
        } else {
          existing.push(m);
        }
      }
      console.log(`[Webhook] Agent enabled, processing ${byContact.size} contact(s)`);

      for (const [contactPhone, contactMessages] of byContact) {
        const sorted = [...contactMessages].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const latest = sorted[0];
        const latestText = (latest.message_text || '').trim();
        if (!latestText) {
          console.log(`[Webhook] Skipping ${contactPhone}: no message text`);
          continue;
        }

        try {
          const shouldUseHistory = capabilities?.neonDbMessages ?? true;
          const turns = shouldUseHistory
            ? buildConversationTurns(
                (
                  await fetchMessagesByPhone(contactPhone, 30)
                ).map((h) => ({ direction: h.direction, message_text: h.message_text }))
              )
            : [];
          const reply = await generateOperatorAwareReply({
            phone: contactPhone,
            contactName: latest.contact_name || contactPhone,
            latestMessage: latestText,
            recentTurns: turns,
            capabilities,
            businessProfile,
            composioSettings:
              composioSettings || {
                composioEnabled: false,
                composioApiKeyPresent: false,
                operatorPhoneAllowlist: [],
                enabledToolkits: [],
                toolExecutionMode: 'operator_only',
                approvalRequiredActions: [],
                defaultToolTimeoutMs: 30000,
                toolResultVerbosity: 'brief',
                autoExecuteReads: true,
              },
          });

          if (reply.replyText) {
            await sendTextReply({
              to: contactPhone,
              body: reply.replyText,
              contactName: latest.contact_name,
            });
            autoReplied.push(contactPhone);
            console.log(`[Webhook] Auto-replied to ${contactPhone} via ${reply.mode}`);
          } else {
            agentError = agentError || 'Agent returned empty reply';
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          agentError = agentError || msg;
          console.error(`[Webhook] Agent reply failed for ${contactPhone}: ${msg}`);
        }
      }
    }

    const body: Record<string, unknown> = {
      status: 'success',
      stored: insertedRows.length,
      statuses: statusCount,
      payloadMessages: messageCount,
      messageIds: insertedRows.map((row) => row.external_message_id),
    };
    if (autoReplied.length > 0) body.autoReplied = autoReplied;
    if (disabledReason) body.agentSkippedReason = disabledReason;
    if (agentError) body.agentError = agentError;

    return NextResponse.json(body);
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
