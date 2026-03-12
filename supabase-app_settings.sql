-- Run this in Supabase: SQL Editor → New query → paste → Run
-- Creates the table required for the Settings page (WhatsApp profile, agent capabilities, automated tasks).

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated ON app_settings(updated_at DESC);
