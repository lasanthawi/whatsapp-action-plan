# WhatsApp Daily Action Plan System

Automated system that captures WhatsApp Business messages and generates daily AI-powered action plans.

## Features
- 📨 Real-time WhatsApp message capture via webhook
- 🗄️ PostgreSQL database (Supabase) for message storage
- 🤖 AI-powered daily analysis with GPT-4
- ⏰ Scheduled daily action plans (7 PM UTC)
- 📱 WhatsApp digest delivery

## Architecture
```
WhatsApp → Webhook → Supabase → Daily Cron → AI Analysis → WhatsApp Digest
```

## Setup

### 1. Database (Supabase)
Run schema.sql in Supabase SQL Editor

### 2. Deploy to Vercel
- Connect this repo
- Set environment variables (see .env.example)
- Deploy automatically

### 3. Configure WhatsApp Webhook
Update webhook URL in Meta Business Suite:
`https://your-vercel-app.vercel.app/api/whatsapp/webhook`

Use the same `WHATSAPP_VERIFY_TOKEN` value in Meta during webhook verification.

## Environment Variables
See `.env.example` for all required variables.

### Auth Setup
- `NEON_AUTH_BASE_URL` - Your Neon Auth base URL
- `NEON_AUTH_COOKIE_SECRET` - A strong secret used to sign cached auth cookies
- `GET/POST /api/auth/[...path]` is used by the Neon Auth integration
- The dashboard root `/` is protected and redirects to `/auth/sign-in`
- User signup is disabled in the app UI; create/manage users from Neon Auth

## API Endpoints
- `POST /api/whatsapp/webhook` - Receives WhatsApp webhooks
- `GET /api/cron/daily-analyzer` - Daily analysis (Vercel Cron)

## Database Schema
- `whatsapp_messages` - Stores all incoming messages
- `daily_action_plans` - Stores generated action plans

## Notes
- The webhook now supports Meta verification via `GET /api/whatsapp/webhook`
- Incoming messages are deduplicated using WhatsApp's external message ID
- The root dashboard is an authenticated inbox for reviewing and replying to chats

Deployed on Vercel | Database on Supabase | Powered by Composio + OpenAI
