-- ============================================================
-- Billing Request OS - Database Schema for Supabase
-- ============================================================
-- Run this entire file in Supabase SQL Editor to create all tables
-- ============================================================

-- ============================================================
-- STEP 1: Create Enum Types
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM ('collector', 'admin', 'supervisor');

-- Agency identifiers
CREATE TYPE agency_id AS ENUM ('ICS', 'MSB', 'VV');

-- All 14 request types
CREATE TYPE request_type AS ENUM (
    -- Insurance / Billing
    'insurance_coverage_claim',
    'wrong_insurance_refile',
    'auto_accident_3rd_party',
    'medicaid_medicare_question',
    -- Payment
    'paid_direct_to_provider',
    'on_payment_plan',
    'payment_posted_wrong',
    -- Identity / Validity
    'not_our_patient',
    'identity_theft_fraud',
    -- Documentation
    'itemized_bill_request',
    'validation_package_request',
    'statement_resend',
    -- Charge Dispute
    'overcharged_balance_incorrect',
    'service_cancelled_not_billed'
);

-- Request workflow statuses
CREATE TYPE request_status AS ENUM ('OPEN', 'CLAIMED', 'SENT', 'RESPONDED', 'CLOSED');

-- Priority levels
CREATE TYPE priority AS ENUM ('NORMAL', 'HIGH');

-- Hold behavior
CREATE TYPE hold_behavior AS ENUM ('hard_hold', 'soft_hold', 'no_hold');

-- Resolution codes
CREATE TYPE resolution_code AS ENUM (
    'DEBT_VALID',
    'BALANCE_ADJUSTED',
    'INSURANCE_PAID',
    'PATIENT_PAID',
    'ACCOUNT_RECALLED',
    'IDENTITY_CONFIRMED_FRAUD',
    'NO_CLIENT_RESPONSE',
    'DUPLICATE_CLOSED',
    'OTHER'
);

-- ============================================================
-- STEP 2: Create Tables
-- ============================================================

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,

    -- Profile
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'collector',
    team VARCHAR(50),
    avatar_url VARCHAR(255),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Clients table (healthcare providers)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,

    -- Contact info
    email VARCHAR(100) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(20),

    -- Additional contacts (JSON array)
    additional_contacts JSONB DEFAULT '[]'::jsonb,

    -- SLA configuration
    sla_hours INTEGER NOT NULL DEFAULT 72,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Billing requests table (core data)
CREATE TABLE billing_requests (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(10) UNIQUE NOT NULL,  -- REQ-0001 format

    -- Agency and client info
    agency_id agency_id NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    account_reference VARCHAR(100) NOT NULL,
    internal_file_id VARCHAR(100),

    -- Debtor info (non-PHI)
    debtor_language VARCHAR(10) DEFAULT 'EN',

    -- Request ownership
    collector_id INTEGER NOT NULL REFERENCES users(id),
    assigned_admin_id INTEGER REFERENCES users(id),

    -- Request details
    request_type request_type NOT NULL,
    required_fields_payload JSONB DEFAULT '{}'::jsonb,
    notes TEXT,

    -- Status tracking
    status request_status NOT NULL DEFAULT 'OPEN',
    priority priority NOT NULL DEFAULT 'NORMAL',
    hold_behavior hold_behavior NOT NULL DEFAULT 'soft_hold',

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMP,
    sent_at TIMESTAMP,
    responded_at TIMESTAMP,
    closed_at TIMESTAMP,

    -- SLA tracking
    sla_due_at TIMESTAMP,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,

    -- Deduplication
    dedupe_key VARCHAR(64),

    -- Resolution
    resolution_code resolution_code,
    resolution_notes TEXT,

    -- Client response
    client_response_payload JSONB,

    -- Portal
    portal_token VARCHAR(64) UNIQUE,
    portal_token_expires_at TIMESTAMP,

    -- Slack integration
    slack_message_ts VARCHAR(50),
    slack_channel_id VARCHAR(50),

    -- Audit trail (immutable event log)
    audit_log JSONB DEFAULT '[]'::jsonb
);

-- Attachments table
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES billing_requests(id) ON DELETE CASCADE,

    -- File info
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,

    -- Storage
    storage_path VARCHAR(500) NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',

    -- Metadata
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_by_client BOOLEAN NOT NULL DEFAULT FALSE,
    description VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 3: Create Indexes
-- ============================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Clients indexes
CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_clients_is_active ON clients(is_active);

-- Billing requests indexes
CREATE INDEX idx_billing_requests_request_id ON billing_requests(request_id);
CREATE INDEX idx_billing_requests_agency_id ON billing_requests(agency_id);
CREATE INDEX idx_billing_requests_account_reference ON billing_requests(account_reference);
CREATE INDEX idx_billing_requests_internal_file_id ON billing_requests(internal_file_id);
CREATE INDEX idx_billing_requests_request_type ON billing_requests(request_type);
CREATE INDEX idx_billing_requests_status ON billing_requests(status);
CREATE INDEX idx_billing_requests_sla_breached ON billing_requests(sla_breached);
CREATE INDEX idx_billing_requests_dedupe_key ON billing_requests(dedupe_key);
CREATE INDEX idx_billing_requests_portal_token ON billing_requests(portal_token);

-- Composite indexes for common queries
CREATE INDEX ix_billing_requests_status_created ON billing_requests(status, created_at);
CREATE INDEX ix_billing_requests_collector_status ON billing_requests(collector_id, status);
CREATE INDEX ix_billing_requests_admin_status ON billing_requests(assigned_admin_id, status);
CREATE INDEX ix_billing_requests_client_status ON billing_requests(client_id, status);
CREATE INDEX ix_billing_requests_sla_breach ON billing_requests(sla_breached, sla_due_at);

-- Attachments indexes
CREATE INDEX idx_attachments_request_id ON attachments(request_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- ============================================================
-- STEP 4: Create Updated_at Trigger Function
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_requests_updated_at
    BEFORE UPDATE ON billing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STEP 5: Create Request ID Sequence
-- ============================================================

CREATE SEQUENCE request_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_request_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_id IS NULL THEN
        NEW.request_id = 'REQ-' || LPAD(nextval('request_id_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_request_id
    BEFORE INSERT ON billing_requests
    FOR EACH ROW
    EXECUTE FUNCTION generate_request_id();

-- ============================================================
-- STEP 6: Seed Data
-- ============================================================

-- Insert admin user (password: admin123)
-- Password hash generated with bcrypt
INSERT INTO users (username, email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'admin',
    'admin@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.2qPJZ8LvGrXZGe',
    'System Administrator',
    'supervisor',
    TRUE,
    TRUE
);

-- Insert sample collector
INSERT INTO users (username, email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'collector1',
    'collector1@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.2qPJZ8LvGrXZGe',
    'John Collector',
    'collector',
    TRUE,
    TRUE
);

-- Insert sample admin
INSERT INTO users (username, email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'admin1',
    'admin1@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.2qPJZ8LvGrXZGe',
    'Jane Admin',
    'admin',
    TRUE,
    TRUE
);

-- Insert sample clients
INSERT INTO clients (code, name, email, contact_name, phone, sla_hours)
VALUES
    ('ABC', 'ABC Hospital', 'billing@abchospital.com', 'Mary Smith', '555-0101', 72),
    ('XYZ', 'XYZ Medical Center', 'ar@xyzmedical.com', 'Bob Johnson', '555-0102', 48),
    ('DEF', 'DEF Healthcare', 'billing@defhealth.com', 'Alice Brown', '555-0103', 72);

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
--
-- Next steps:
-- 1. Configure your backend/.env file with Supabase credentials
-- 2. Start the backend server
-- 3. Login with: admin / admin123
-- ============================================================
