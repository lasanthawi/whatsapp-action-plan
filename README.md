# WhatsApp Action Plan System

This app captures WhatsApp Business messages, stores them in Supabase, replies from a secured dashboard, and can now let approved operators trigger Composio-powered tools directly from WhatsApp.

## Features
- Real-time WhatsApp webhook ingestion
- Supabase-backed message history and outbound logging
- OpenAI-powered chat agent replies
- Operator-only Composio tool execution with in-chat auth links
- Approval gating for sensitive/write actions
- Settings dashboard for profile, agent, toolkit, and automation controls
- Daily action-plan cron flow

## Architecture
```text
WhatsApp -> Webhook -> Supabase -> Agent orchestration -> WhatsApp reply
                                  -> Composio sessions/tools
                                  -> Daily analyzer cron
```

## Setup

### 1. Database
Run [schema.sql](schema.sql) in Supabase SQL Editor.

This creates:
- `whatsapp_messages`
- `daily_action_plans`
- `app_settings`
- `tool_identities`
- `tool_connections`
- `tool_runs`
- `tool_approvals`
- `tool_auth_sessions`

### 2. Deploy to Vercel
- Connect this repo
- Add the environment variables from `.env.example`
- Redeploy after every env var change

### 3. Configure WhatsApp webhook
Set the callback URL in Meta Business Suite to:

`https://your-vercel-app.vercel.app/api/whatsapp/webhook`

Use the same `WHATSAPP_VERIFY_TOKEN` value during Meta webhook verification.

## Environment Variables
See `.env.example` for the full list.

Important groups:
- Auth: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`
- OpenAI: `OPENAI_API_KEY`
- Composio: `COMPOSIO_API_KEY`, `COMPOSIO_CALLBACK_BASE_URL`

## Composio operator mode
- Tool execution is operator-only in v1
- Add approved operator WhatsApp numbers in Settings
- Enable the desired toolkits in Settings
- Connect each toolkit from Settings or let the agent send a connect link in WhatsApp
- Sensitive actions require an explicit `confirm` message before execution

## API Endpoints
- `POST /api/whatsapp/webhook` - receive WhatsApp events
- `GET /api/whatsapp/webhook` - Meta verification
- `GET /api/messages` - thread polling for the dashboard
- `GET /api/cron/daily-analyzer` - daily analysis run

## Notes
- Incoming messages are deduplicated by WhatsApp external message ID
- Outbound dashboard replies are stored in `whatsapp_messages`
- Operator chats can use Composio-backed tool execution; customer chats stay on the normal support reply path
