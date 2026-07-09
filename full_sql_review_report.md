As a Senior Database Administrator, I have thoroughly reviewed the provided PostgreSQL schema definitions. Below are my findings, optimization recommendations, and security considerations, presented in a structured Markdown report.

---

# Database Schema Review Report

**Date:** July 8, 2026
**Reviewer:** Senior Database Administrator

## I. Overview

The schema defines tables for a PDPA Compliance Platform, covering organizations, users, subscriptions, various types of scans (website, social media), Data Subject Right (DSR) requests, and consent logging. The use of `UUID` for primary keys and `TIMESTAMP WITH TIME ZONE` for date fields is a good practice. The schema generally demonstrates a clear understanding of data modeling for a compliance-focused application.

## II. Table Relationships

The schema correctly establishes relationships using `FOREIGN KEY` constraints with `ON DELETE CASCADE`, which is appropriate for managing dependent data lifecycle (e.g., deleting an organization cascades to its users, subscriptions, etc.).

*   **`organizations` (Parent)**
    *   `users`: `organization_id` REFERENCES `organizations(id)`
    *   `subscriptions`: `organization_id` REFERENCES `organizations(id)`
    *   `scans`: `organization_id` REFERENCES `organizations(id)`
    *   `dsr_requests`: `organization_id` REFERENCES `organizations(id)`
    *   `consent_logs`: `organization_id` REFERENCES `organizations(id)`

## III. Query Optimizations & Missing Indexes

Existing indexes are generally well-placed for common organizational-level lookups. However, several additional indexes could significantly improve query performance, especially as data volume grows.

### Existing Indexes:

*   `users`: `PRIMARY KEY (id)`, `UNIQUE (email)`, `INDEX idx_users_org (organization_id)`
*   `organizations`: `PRIMARY KEY (id)`
*   `subscriptions`: `PRIMARY KEY (id)`
*   `scans`: `PRIMARY KEY (id)`, `INDEX idx_scans_org_date (organization_id, created_at DESC)`
*   `dsr_requests`: `PRIMARY KEY (id)`, `INDEX idx_dsr_org_status (organization_id, status)`
*   `consent_logs`: `PRIMARY KEY (id)`, `INDEX idx_consent_org_date (organization_id, created_at)`

### Recommended Additional Indexes:

1.  **`organizations`**:
    *   Consider an index on `name` if organizations are frequently searched or filtered by name:
        ```sql
        CREATE INDEX idx_organizations_name ON organizations(name);
        ```

2.  **`users`**:
    *   The `email` column already has a unique constraint, which implicitly creates an index.
    *   Consider an index on `role` if role-based filtering is common, especially across all users:
        ```sql
        CREATE INDEX idx_users_role ON users(role);
        ```
    *   If combining `organization_id` and `role` for queries (e.g., "get all ADMINs in an organization"), a composite index would be beneficial:
        ```sql
        CREATE INDEX idx_users_org_role ON users(organization_id, role);
        ```

3.  **`subscriptions`**:
    *   An index on `organization_id` is crucial since it's a foreign key and likely used for filtering. (Note: PostgreSQL might implicitly index FKs in some cases, but explicit creation is safer if not guaranteed).
    *   `stripe_customer_id` and `stripe_subscription_id` will be used for payment gateway lookups. These should be indexed.
        ```sql
        CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
        CREATE UNIQUE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
        CREATE UNIQUE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
        ```
    *   `status` and `plan_tier` if frequently filtered or grouped:
        ```sql
        CREATE INDEX idx_subscriptions_status ON subscriptions(status);
        CREATE INDEX idx_subscriptions_plan_tier ON subscriptions(plan_tier);
        ```

4.  **`scans`**:
    *   `target_identifier` is a key search field (e.g., domain name).
    *   `status` is likely frequently filtered.
    *   `completed_at` for queries on completed scans or reporting.
        ```sql
        CREATE INDEX idx_scans_target_identifier ON scans(target_identifier);
        CREATE INDEX idx_scans_status ON scans(status);
        CREATE INDEX idx_scans_completed_at ON scans(completed_at);
        ```
    *   For `findings_json` (`JSONB`), if you frequently query specific keys or paths within the JSON (e.g., `findings_json @> '{"vulnerability_type": "X"}'`), a GIN index can be highly beneficial:
        ```sql
        CREATE INDEX idx_scans_findings_json_gin ON scans USING GIN (findings_json);
        ```

5.  **`dsr_requests`**:
    *   `subject_email` is a critical lookup field for DSR requests.
    *   `due_date` is critical for compliance and likely queried to find overdue requests.
        ```sql
        CREATE INDEX idx_dsr_requests_subject_email ON dsr_requests(subject_email);
        CREATE INDEX idx_dsr_requests_due_date ON dsr_requests(due_date);
        ```
    *   `request_type` if frequently filtered.
        ```sql
        CREATE INDEX idx_dsr_requests_request_type ON dsr_requests(request_type);
        ```

6.  **`consent_logs`**:
    *   As noted, this is a high-volume table.
    *   `visitor_id` and `ip_address_hash` are primary lookup fields for individual consent records.
        ```sql
        CREATE INDEX idx_consent_logs_visitor_id ON consent_logs(visitor_id);
        CREATE INDEX idx_consent_logs_ip_address_hash ON consent_logs(ip_address_hash);
        ```
    *   `consent_given` if frequently filtered.
        ```sql
        CREATE INDEX idx_consent_logs_consent_given ON consent_logs(consent_given);
        ```
    *   For `consent_categories` (`JSONB`), a GIN index would be beneficial if frequently querying specific consent preferences (e.g., `consent_categories @> '{"marketing": true}'`):
        ```sql
        CREATE INDEX idx_consent_logs_consent_categories_gin ON consent_logs USING GIN (consent_categories);
        ```
    *   **Partitioning**: For a "high volume table," consider PostgreSQL table partitioning by `created_at`. This can drastically improve query performance and maintenance for time-series data. This is an architectural decision beyond simple indexing, requiring careful planning.

## IV. Critical Security Flaws & Best Practices

The schema itself is generally robust from a SQL injection perspective, as it defines data structures, not application logic. However, several areas warrant attention regarding how the application interacts with this schema:

1.  **SQL Injection Prevention (Application Layer):**
    *   **ALWAYS** use parameterized queries or prepared statements in the application layer when interacting with the database. Never concatenate user input directly into SQL strings. This is the primary defense against SQL injection.

2.  **Password Storage (`users.password_hash`):**
    *   The schema correctly stores `password_hash` instead of plaintext passwords.
    *   **Crucial:** Ensure the application uses a strong, modern, and computationally expensive hashing algorithm (e.g., Argon2, bcrypt, scrypt) with appropriate salt. Never use weak algorithms like MD5 or SHA1.

3.  **Data Minimization & Privacy (`consent_logs.ip_address_hash`):**
    *   Hashing `ip_address_hash` is a good privacy measure. Ensure the hashing function is one-way and irreversible to truly protect privacy, and that the original IP is not logged elsewhere.
    *   Consider the retention policy for `consent_logs` and other sensitive data. GDPR/PDPA requires data to be kept no longer than necessary.

4.  **Role-Based Access Control (`users.role`):**
    *   The `role` column is present, which implies RBAC. Ensure the application rigorously enforces these roles at every API endpoint and data access layer, preventing unauthorized actions. The database schema facilitates this by allowing role assignment, but enforcement is strictly an application concern.

5.  **`pgcrypto` Extension:**
    *   The `init-db.sql` file includes `CREATE EXTENSION IF NOT EXISTS pgcrypto;`. This is excellent for enabling cryptographic functions directly within PostgreSQL, which can be useful for functions like `gen_salt()` and `crypt()` if password hashing or other cryptographic operations are performed at the database level (though often better handled in the application).

## V. Optimized SQL Schema (with Recommendations)

```sql
-- init-db.sql additions for consistency and pgcrypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PrivacyReady PDPA Compliance Platform
-- Initial PostgreSQL Schema Definition

-- Enable UUID extension for unique identifiers
-- (Already created in init-db.sql for broader use)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX idx_organizations_name ON organizations(name); -- Recommended index

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL, -- UNIQUE constraint implicitly creates an index
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'MEMBER', -- ADMIN, MEMBER
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_org ON users(organization_id); -- Existing
CREATE INDEX idx_users_role ON users(role); -- Recommended index
CREATE INDEX idx_users_org_role ON users(organization_id, role); -- Recommended composite index

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

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id); -- Recommended index for FK
CREATE UNIQUE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL; -- Recommended unique index, consider partial for NULLs
CREATE UNIQUE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL; -- Recommended unique index, consider partial for NULLs
CREATE INDEX idx_subscriptions_status ON subscriptions(status); -- Recommended index
CREATE INDEX idx_subscriptions_plan_tier ON subscriptions(plan_tier); -- Recommended index

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

CREATE INDEX idx_scans_org_date ON scans(organization_id, created_at DESC); -- Existing
CREATE INDEX idx_scans_target_identifier ON scans(target_identifier); -- Recommended index
CREATE INDEX idx_scans_status ON scans(status); -- Recommended index
CREATE INDEX idx_scans_completed_at ON scans(completed_at); -- Recommended index
CREATE INDEX idx_scans_findings_json_gin ON scans USING GIN (findings_json); -- Recommended GIN index for JSONB queries

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

CREATE INDEX idx_dsr_org_status ON dsr_requests(organization_id, status); -- Existing
CREATE INDEX idx_dsr_requests_subject_email ON dsr_requests(subject_email); -- Recommended index
CREATE INDEX idx_dsr_requests_due_date ON dsr_requests(due_date); -- Recommended index
CREATE INDEX idx_dsr_requests_request_type ON dsr_requests(request_type); -- Recommended index

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

CREATE INDEX idx_consent_org_date ON consent_logs(organization_id, created_at); -- Existing
CREATE INDEX idx_consent_logs_visitor_id ON consent_logs(visitor_id); -- Recommended index
CREATE INDEX idx_consent_logs_ip_address_hash ON consent_logs(ip_address_hash); -- Recommended index
CREATE INDEX idx_consent_logs_consent_given ON consent_logs(consent_given); -- Recommended index
CREATE INDEX idx_consent_logs_consent_categories_gin ON consent_logs USING GIN (consent_categories); -- Recommended GIN index for JSONB queries
```

---
