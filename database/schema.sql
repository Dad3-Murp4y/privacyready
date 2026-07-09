-- PrivacyReady PDPA Compliance Platform
-- Initial PostgreSQL Schema Definition

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Organizations & Users
-- ==========================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'MEMBER', -- ADMIN, MEMBER
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. Billing & Subscriptions
-- ==========================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL, -- FREE, PRO, ENTERPRISE
    status VARCHAR(50) NOT NULL, -- ACTIVE, CANCELED, PAST_DUE
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. Scanners & Audits (Website & Social)
-- ==========================================

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL, -- WEBSITE, FACEBOOK, LINE, TIKTOK
    target_identifier VARCHAR(255) NOT NULL, -- e.g., "example.com" or "FB_PAGE_123"
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED
    score INTEGER, -- 0 to 100
    risk_level VARCHAR(50), -- LOW, MEDIUM, HIGH, CRITICAL
    findings_json JSONB, -- Store raw scanner output and detailed checks
    pdf_report_url VARCHAR(500), -- Link to generated certificate/report in S3
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 4. Data Subject Rights (DSR) Manager
-- ==========================================

CREATE TABLE dsr_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject_email VARCHAR(255) NOT NULL,
    subject_name VARCHAR(255),
    request_type VARCHAR(50) NOT NULL, -- ERASURE, ACCESS, RECTIFICATION
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_REVIEW, APPROVED, REJECTED, COMPLETED
    reason_text TEXT,
    internal_notes TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL, -- PDPA mandates strict deadlines (e.g. 30 days)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 5. Consent Management (Cookie Banner Logs)
-- ==========================================
-- High volume table, usually requires partitioning or separate timeseries DB in production

CREATE TABLE consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    visitor_id VARCHAR(255) NOT NULL, -- Anonymous cookie ID
    ip_address_hash VARCHAR(255) NOT NULL, -- Hashed for privacy
    consent_given BOOLEAN NOT NULL,
    consent_categories JSONB, -- e.g., {"marketing": true, "analytics": false}
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Indexes for Performance
-- ==========================================
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_scans_org_date ON scans(organization_id, created_at DESC);
CREATE INDEX idx_dsr_org_status ON dsr_requests(organization_id, status);
CREATE INDEX idx_consent_org_date ON consent_logs(organization_id, created_at);
