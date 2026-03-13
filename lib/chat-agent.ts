/**
 * Chat agent: generates contextual auto-replies for incoming WhatsApp messages.
 * Uses OpenAI to ask clarifications, give solutions, suggestions, or quick answers.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AGENT_MODEL = process.env.CHAT_AGENT_MODEL ?? 'gpt-4o-mini';

export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentCapabilitiesContext = {
  neonDbMessages: boolean;
  github: boolean;
  facebook: boolean;
  linkedin: boolean;
  drive: boolean;
  composioTools: boolean;
  autoReplyMode: boolean;
};

export type BusinessProfileContext = {
  description?: string;
  email?: string;
  address?: string;
  website?: string;
};

function listConnectedIntegrations(
  capabilities?: Partial<AgentCapabilitiesContext>
): string[] {
  if (!capabilities?.composioTools) return [];
  const integrations: string[] = [];
  if (capabilities.github) integrations.push('GitHub');
  if (capabilities.facebook) integrations.push('Facebook');
  if (capabilities.linkedin) integrations.push('LinkedIn');
  if (capabilities.drive) integrations.push('Google Drive');
  return integrations;
}

function buildSystemPrompt(params: {
  capabilities?: Partial<AgentCapabilitiesContext>;
  businessProfile?: BusinessProfileContext;
}) {
  const integrations = listConnectedIntegrations(params.capabilities);
  const profileLines = [
    params.businessProfile?.description
      ? `- Business description: ${params.businessProfile.description}`
      : null,
    params.businessProfile?.email
      ? `- Business email: ${params.businessProfile.email}`
      : null,
    params.businessProfile?.address
      ? `- Business address: ${params.businessProfile.address}`
      : null,
    params.businessProfile?.website
      ? `- Business website: ${params.businessProfile.website}`
      : null,
  ].filter(Boolean);

  return `You are a helpful WhatsApp business assistant. When a customer sends a message, reply in a friendly, concise way suitable for chat.

Runtime context:
- You can read this chat thread and recent message history.
- Connected external tools: ${integrations.length > 0 ? integrations.join(', ') : 'none'}.
${profileLines.length > 0 ? profileLines.join('\n') : '- No business profile details are configured.'}

Your replies can:
- Ask clarifications when the request is vague or you need one or two details.
- Give solutions when the customer has a clear problem.
- Give suggestions when they are exploring options.
- Give quick answers for simple questions.

Rules:
- Keep each reply short: 1-3 sentences for WhatsApp.
- Be professional but warm. No slang unless the customer uses it.
- Never say you cannot access this chat's message history.
- If user asks to use an external tool that is not connected, say what to connect in Settings and offer the next best step.
- For media-only messages (e.g. image/voice placeholders), acknowledge what was received and ask one useful follow-up question.
- Never make up links, prices, or policies. Say "I don't have that info to hand" if needed.
- Reply in the same language the customer uses when possible.`;
}

/**
 * Builds the conversation history for the API from stored messages.
 * Inbound = user, outbound = assistant.
 */
export function buildConversationTurns(messages: Array<{ direction: string; message_text: string | null }>): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const m of messages) {
    const text = (m.message_text || '').trim();
    if (!text) continue;

    if (m.direction === 'inbound') {
      turns.push({ role: 'user', content: text });
    } else {
      turns.push({ role: 'assistant', content: text });
    }
  }

  return turns;
}

/**
 * Generates a single reply for the latest customer message using recent conversation context.
 */
export async function generateAgentReply(params: {
  contactName: string;
  latestMessage: string;
  recentTurns: ConversationTurn[];
  capabilities?: Partial<AgentCapabilitiesContext>;
  businessProfile?: BusinessProfileContext;
}): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const { contactName, latestMessage, recentTurns } = params;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: buildSystemPrompt({
        capabilities: params.capabilities,
        businessProfile: params.businessProfile,
      }),
    },
  ];

  // Add recent conversation (excluding the latest user message if it's already in recentTurns)
  const turnsToSend = recentTurns.length > 20 ? recentTurns.slice(-20) : recentTurns;
  for (const t of turnsToSend) {
    messages.push({ role: t.role, content: t.content });
  }

  // If the latest message isn't already the last turn, add it
  const lastTurn = turnsToSend[turnsToSend.length - 1];
  if (lastTurn?.content !== latestMessage) {
    messages.push({ role: 'user', content: latestMessage });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages,
      max_tokens: 256,
      temperature: 0.7,
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const errMsg = data?.error?.message || response.statusText;
    throw new Error(`OpenAI API error: ${errMsg}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned an empty reply');
  }

  return content;
}

/**
 * Check if the auto-reply agent is enabled and configured.
 * Default: enabled when OPENAI_API_KEY is set, unless explicitly disabled via env.
 */
export function isAgentEnabled(): boolean {
  if (!OPENAI_API_KEY) return false;
  const env = process.env.ENABLE_AUTO_REPLY_AGENT;
  if (env === 'false' || env === '0' || env === 'no') return false;
  return true;
}

/** Reason the agent is disabled (for logging/debug). */
export function getAgentDisabledReason(): string | null {
  if (!process.env.OPENAI_API_KEY) return 'OPENAI_API_KEY not set';
  const env = process.env.ENABLE_AUTO_REPLY_AGENT;
  if (env === 'false' || env === '0' || env === 'no') return 'ENABLE_AUTO_REPLY_AGENT is disabled';
  return null;
}
