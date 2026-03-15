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

-- Tool identities map WhatsApp operators to Composio users
CREATE TABLE IF NOT EXISTS tool_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(50) NOT NULL UNIQUE,
    composio_user_id VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_identities_phone ON tool_identities(phone);

-- Toolkit connection state for each operator phone
CREATE TABLE IF NOT EXISTS tool_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(50) NOT NULL,
    toolkit VARCHAR(100) NOT NULL,
    connected_account_id VARCHAR(255),
    auth_config_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'inactive',
    last_verified_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phone, toolkit)
);

CREATE INDEX IF NOT EXISTS idx_tool_connections_phone ON tool_connections(phone);
CREATE INDEX IF NOT EXISTS idx_tool_connections_toolkit ON tool_connections(toolkit);

-- Audit log for every tool execution attempt
CREATE TABLE IF NOT EXISTS tool_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_phone VARCHAR(50) NOT NULL,
    toolkit VARCHAR(100) NOT NULL,
    tool_slug VARCHAR(255) NOT NULL,
    arguments_summary TEXT,
    result_summary TEXT,
    status VARCHAR(50) NOT NULL,
    approval_state VARCHAR(50) NOT NULL DEFAULT 'not_required',
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_runs_phone_created ON tool_runs(requester_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_runs_status ON tool_runs(status);

-- Pending approvals for sensitive/write actions
CREATE TABLE IF NOT EXISTS tool_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_phone VARCHAR(50) NOT NULL,
    toolkit VARCHAR(100) NOT NULL,
    tool_slug VARCHAR(255) NOT NULL,
    action_title TEXT NOT NULL,
    arguments_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_approvals_phone_status ON tool_approvals(requester_phone, status, created_at DESC);

-- Pending in-chat auth sessions waiting for operator to finish the connect link
CREATE TABLE IF NOT EXISTS tool_auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_phone VARCHAR(50) NOT NULL,
    toolkit VARCHAR(100) NOT NULL,
    composio_user_id VARCHAR(255) NOT NULL,
    redirect_url TEXT,
    callback_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_auth_sessions_phone_status ON tool_auth_sessions(requester_phone, status, created_at DESC);
