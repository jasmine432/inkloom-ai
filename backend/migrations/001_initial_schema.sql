-- ==============================================================================
-- Inkloom AI — PostgreSQL / Supabase Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- Description: Creates profiles, reviews, findings, and evidence_citations tables.
-- Authentication: Firebase Authentication is identity provider (no passwords in DB).
-- Multi-tenancy: Every private record is indexed and bound to Firebase user_id.
-- ==============================================================================

-- Safety Guard: Reject polar_logistics unconditionally, permit only 'inkloom_ai' or Supabase 'postgres'
DO $$
BEGIN
    IF current_database() = 'polar_logistics' THEN
        RAISE EXCEPTION 'Database isolation violation: Inkloom AI migrations cannot execute on "polar_logistics". Execution terminated unconditionally.';
    END IF;
    IF current_database() NOT IN ('inkloom_ai', 'postgres') THEN
        RAISE EXCEPTION 'Database isolation violation: Migration 001 cannot execute on database "%". Target must be strictly "inkloom_ai" (local) or "postgres" (Supabase).', current_database();
    END IF;
END $$;

-- 1. User Profiles (Synced from verified Firebase Auth sessions)
CREATE TABLE IF NOT EXISTS profiles (
    user_id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 2. Marketing Copy Audits / Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    channel VARCHAR(100),
    target_audience VARCHAR(100),
    is_demo BOOLEAN DEFAULT FALSE,
    execution_mode VARCHAR(64) DEFAULT 'live_gemini_structured',
    overall_trust_score INT DEFAULT 100,
    total_findings INT DEFAULT 0,
    supported_count INT DEFAULT 0,
    contradicted_count INT DEFAULT 0,
    insufficient_count INT DEFAULT 0,
    conflicting_count INT DEFAULT 0,
    needs_review_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);

-- 3. Audit Findings (Claim Verification Items)
CREATE TABLE IF NOT EXISTS findings (
    id VARCHAR(64) PRIMARY KEY,
    review_id VARCHAR(64) NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    claim TEXT NOT NULL,
    status VARCHAR(64) NOT NULL,
    explanation TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    paragraph_index INT,
    reviewer_decision VARCHAR(32) DEFAULT 'PENDING',
    reviewer_notes TEXT,
    category VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_findings_review_id ON findings(review_id);
CREATE INDEX IF NOT EXISTS idx_findings_user_id ON findings(user_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);

-- 4. Evidence Citations (Ground-Truth Source Quotes)
CREATE TABLE IF NOT EXISTS evidence_citations (
    id VARCHAR(64) PRIMARY KEY,
    finding_id VARCHAR(64) NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    source_id VARCHAR(128),
    source_title TEXT NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    document_version VARCHAR(64),
    last_updated VARCHAR(64) NOT NULL,
    quote TEXT NOT NULL,
    section TEXT NOT NULL,
    confidence_score INT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_finding_id ON evidence_citations(finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence_citations(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source_id ON evidence_citations(source_id);
