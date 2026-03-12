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

const SYSTEM_PROMPT = `You are a helpful WhatsApp business assistant. When a customer sends a message, reply in a friendly, concise way suitable for chat.

Your replies can:
- **Ask clarifications** when the request is vague or you need one or two details to help (e.g. "Which date works for you?" or "Do you mean X or Y?")
- **Give solutions** when the customer has a clear problem (steps, links, or direct answers)
- **Give suggestions** when they're exploring options (short pros/cons or recommendations)
- **Give quick answers** for simple questions (yes/no, one line, or a short fact)

Rules:
- Keep each reply short: 1–3 sentences for WhatsApp. No long paragraphs.
- Be professional but warm. No slang unless the customer uses it.
- If you truly don't know or it's outside your role, say so briefly and offer to connect them to a human if needed.
- Never make up links, prices, or policies. Say "I don't have that info to hand" if needed.
- Reply in the same language the customer uses when possible.`;

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
}): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const { contactName, latestMessage, recentTurns } = params;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
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
