# Auto-reply agent: context and tools

## What the agent uses today

- **Conversation history (DB)**  
  For each incoming WhatsApp message, the webhook loads the last 30 messages for that contact from the database (Supabase `whatsapp_messages`), builds user/assistant turns, and sends them to OpenAI with the new message. So the model **does** have access to previous messages; the system prompt tells it to use this context.

- **No tool calls**  
  The agent uses a single OpenAI chat completion. It does not call external tools (GitHub, Drive, Composio, etc.) during reply generation.

## Settings vs behavior

The **Settings → Chat agent capabilities** toggles (Neon DB messages, GitHub, Composio tools, etc.) are stored in `app_settings` and shown in the UI, but **only** the conversation history from the DB is currently passed to the model. The other options are for future use when tool-calling or Composio is wired in.

## If the agent says it “doesn’t have access”

- The model is instructed in the system prompt that it **does** have the recent conversation and must not claim otherwise. If you still see that, try a redeploy so the updated prompt is used.
- Ensure the webhook can read from Supabase (same DB that stores messages) so `fetchMessagesByPhone` returns history. If the DB is empty for that contact, the “recent turns” will be minimal but the latest message is always sent.

## Adding Composio or other tools later

To let the agent use Composio (or other APIs):

1. Add `COMPOSIO_API_KEY` (and any required IDs) to env; see `.env.example`.
2. In the webhook (or a dedicated agent layer), after building conversation turns, call Composio (or another tool API) when the user intent requires it.
3. Either inject tool results into the prompt as context, or use OpenAI function/tool calling and pass tool outputs back into the conversation before generating the final reply.

Until that wiring exists, the agent relies only on conversation history from the database.
