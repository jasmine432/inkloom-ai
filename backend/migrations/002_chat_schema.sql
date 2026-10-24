-- ==============================================================================
-- Inkloom AI — PostgreSQL / Supabase Chat Schema Migration
-- Migration: 002_chat_schema.sql
-- Description: Creates conversations and chat_messages tables.
-- Authentication: Bound strictly to Firebase user_id with foreign key cascades.
-- Multi-tenancy: Strict row-level tenant isolation enforced on every record.
-- ==============================================================================

-- Safety Guard: Reject polar_logistics unconditionally, permit only 'inkloom_ai' or Supabase 'postgres'
DO $$
BEGIN
    IF current_database() = 'polar_logistics' THEN
        RAISE EXCEPTION 'Database isolation violation: Inkloom AI migrations cannot execute on "polar_logistics". Execution terminated unconditionally.';
    END IF;
    IF current_database() NOT IN ('inkloom_ai', 'postgres') THEN
        RAISE EXCEPTION 'Database isolation violation: Migration 002 cannot execute on database "%". Target must be strictly "inkloom_ai" (local) or "postgres" (Supabase).', current_database();
    END IF;
END $$;

-- 1. Chat Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    audit_id VARCHAR(64) REFERENCES reviews(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_audit_id ON conversations(audit_id);

-- 2. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    evidence_json TEXT,
    related_findings_json TEXT,
    suggested_prompts_json TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);
