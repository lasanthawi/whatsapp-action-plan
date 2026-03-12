-- WhatsApp Message Database Schema
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    external_message_id VARCHAR(255),
    contact_phone VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    meta_phone_number_id VARCHAR(255),
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255);

ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contact_phone ON whatsapp_messages(contact_phone);
CREATE INDEX IF NOT EXISTS idx_direction ON whatsapp_messages(direction);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_message_id ON whatsapp_messages(external_message_id);

-- Daily action plans table
CREATE TABLE IF NOT EXISTS daily_action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_date DATE NOT NULL UNIQUE,
    summary TEXT,
    action_items JSONB,
    urgent_count INTEGER DEFAULT 0,
    tasks_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_date ON daily_action_plans(plan_date DESC);

-- App settings (key-value store for dashboard/settings UI)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated ON app_settings(updated_at DESC);
