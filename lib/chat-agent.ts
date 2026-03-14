/**
 * Chat agent: generates contextual auto-replies for incoming WhatsApp messages.
 * Uses OpenAI to ask clarifications, give solutions, suggestions, or quick answers.
 */

import type {
  AgentCapabilitiesSettings,
  WhatsAppProfileSettings,
} from '@/lib/settings';

export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentCapabilitiesContext = AgentCapabilitiesSettings;
export type BusinessProfileContext = WhatsAppProfileSettings;

const DEFAULT_AGENT_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a helpful WhatsApp business assistant. Reply like a real operations person: warm, concise, and practical.

You can see the recent conversation history. Use it when it helps, and avoid repeating what was already said.

Your replies can:
- ask one short clarification if the request is ambiguous
- give a direct answer when the user is asking something simple
- suggest the next step when the user needs help
- acknowledge the user's context naturally

Rules:
- Keep replies short: 1 to 3 sentences
- Sound human and natural, not robotic or overly formal
- Do not invent links, prices, stock, or policies
- If the message needs a human decision, say so briefly and offer to follow up
- Match the customer's language when possible`;

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || '';
}

function getAgentModel() {
  return process.env.CHAT_AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL;
}

function sanitizeProviderMessage(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/api key provided:[^.,\n]*/gi, 'API key provided: [redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function toOpenAiError(status: number, providerMessage?: string) {
  const safeMessage = sanitizeProviderMessage(providerMessage || '');

  if (status === 401 || /incorrect api key|invalid api key|api key provided/i.test(safeMessage)) {
    return new Error(
      'OpenAI request failed: OPENAI_API_KEY was rejected. Update the key in Vercel and redeploy.'
    );
  }

  if (status === 429 || /rate limit|quota|billing/i.test(safeMessage)) {
    return new Error(
      'OpenAI request failed: the account is rate limited or out of quota. Check billing and usage.'
    );
  }

  if (status >= 500) {
    return new Error('OpenAI request failed: the model service is temporarily unavailable.');
  }

  return new Error(
    safeMessage
      ? `OpenAI request failed: ${safeMessage}`
      : `OpenAI request failed with status ${status}.`
  );
}

/**
 * Builds the conversation history for the API from stored messages.
 * Inbound = user, outbound = assistant.
 */
export function buildConversationTurns(
  messages: Array<{ direction: string; message_text: string | null }>
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const message of messages) {
    const text = (message.message_text || '').trim();
    if (!text) continue;

    turns.push({
      role: message.direction === 'inbound' ? 'user' : 'assistant',
      content: text,
    });
  }

  return turns;
}

function buildBusinessContext(profile?: BusinessProfileContext) {
  if (!profile) return '';

  const facts = [
    profile.description ? `Business description: ${profile.description}` : null,
    profile.email ? `Business email: ${profile.email}` : null,
    profile.address ? `Business address: ${profile.address}` : null,
    profile.website ? `Business website: ${profile.website}` : null,
  ].filter(Boolean);

  return facts.length ? `\n\nBusiness context:\n${facts.join('\n')}` : '';
}

/**
 * Generates a single reply for the latest customer message using recent conversation context.
 */
export async function generateAgentReply(params: {
  contactName: string;
  latestMessage: string;
  recentTurns: ConversationTurn[];
  capabilities?: AgentCapabilitiesContext;
  businessProfile?: BusinessProfileContext;
}): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const {
    contactName,
    latestMessage,
    recentTurns,
    capabilities,
    businessProfile,
  } = params;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content:
        `${SYSTEM_PROMPT}\n\nCustomer name: ${contactName}` +
        buildBusinessContext(businessProfile) +
        `\n\nCapabilities:\n- Conversation history available: ${
          capabilities?.neonDbMessages ?? true ? 'yes' : 'no'
        }\n- Auto-reply enabled: ${capabilities?.autoReplyMode ?? true ? 'yes' : 'no'}`,
    },
  ];

  const turnsToSend = recentTurns.length > 20 ? recentTurns.slice(-20) : recentTurns;
  for (const turn of turnsToSend) {
    messages.push({ role: turn.role, content: turn.content });
  }

  const lastTurn = turnsToSend[turnsToSend.length - 1];
  if (lastTurn?.content !== latestMessage) {
    messages.push({ role: 'user', content: latestMessage });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getAgentModel(),
      messages,
      max_tokens: 180,
      temperature: 0.5,
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw toOpenAiError(response.status, data?.error?.message || response.statusText);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned an empty reply.');
  }

  return content;
}

/**
 * Check if the auto-reply agent is enabled and configured.
 * Default: enabled when OPENAI_API_KEY is set, unless explicitly disabled via env.
 */
export function isAgentEnabled(): boolean {
  if (!getOpenAiApiKey()) return false;
  const env = process.env.ENABLE_AUTO_REPLY_AGENT;
  if (env === 'false' || env === '0' || env === 'no') return false;
  return true;
}

/** Reason the agent is disabled (for logging/debug). */
export function getAgentDisabledReason(): string | null {
  if (!getOpenAiApiKey()) return 'OPENAI_API_KEY not set';
  const env = process.env.ENABLE_AUTO_REPLY_AGENT;
  if (env === 'false' || env === '0' || env === 'no') {
    return 'ENABLE_AUTO_REPLY_AGENT is disabled';
  }
  return null;
}
