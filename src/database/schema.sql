-- Diligence Cubed - Database Schema
-- Multi-tenant due diligence platform with deal isolation

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Deals: Top-level entity with complete isolation
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    target_company VARCHAR(255) NOT NULL,
    deal_type VARCHAR(50) NOT NULL, -- 'acquisition', 'investment', 'merger'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
    current_phase VARCHAR(50) NOT NULL DEFAULT 'discovery', -- 'discovery', 'deep_dive', 'validation', 'synthesis'

    -- Deal metadata
    deal_size_usd DECIMAL(15, 2),
    target_industry VARCHAR(100),
    target_region VARCHAR(100),

    -- Security: Each deal has unique encryption key reference
    encryption_key_id UUID NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    target_close_date DATE,

    -- Audit
    created_by UUID NOT NULL,

    CONSTRAINT deal_type_check CHECK (deal_type IN ('acquisition', 'investment', 'merger', 'other')),
    CONSTRAINT deal_status_check CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
    CONSTRAINT deal_phase_check CHECK (current_phase IN ('discovery', 'deep_dive', 'validation', 'synthesis', 'completed'))
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_phase ON deals(current_phase);
CREATE INDEX idx_deals_created_at ON deals(created_at);

-- ============================================================================
-- USER MANAGEMENT & RBAC
-- ============================================================================

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'partner', 'manager', 'lead', 'analyst', 'client_viewer', 'auditor'
    status VARCHAR(50) NOT NULL DEFAULT 'active',

    -- Authentication
    api_key_hash TEXT,
    last_login TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT user_role_check CHECK (role IN ('partner', 'manager', 'lead', 'analyst', 'client_viewer', 'auditor', 'admin')),
    CONSTRAINT user_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Deal Access Control
CREATE TABLE deal_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level VARCHAR(50) NOT NULL, -- 'full', 'workstream_specific', 'read_only'
    workstreams TEXT[], -- NULL for full access, array of workstreams for limited access

    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT deal_access_level_check CHECK (access_level IN ('full', 'workstream_specific', 'read_only')),
    UNIQUE(deal_id, user_id)
);

CREATE INDEX idx_deal_access_deal ON deal_access(deal_id);
CREATE INDEX idx_deal_access_user ON deal_access(user_id);

-- ============================================================================
-- DOCUMENT REPOSITORY
-- ============================================================================

-- Phases within a deal
CREATE TABLE deal_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    phase_name VARCHAR(50) NOT NULL,
    phase_order INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT phase_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    UNIQUE(deal_id, phase_name)
);

CREATE INDEX idx_deal_phases_deal ON deal_phases(deal_id);

-- Workstreams within phases
CREATE TABLE workstreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES deal_phases(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'financial', 'commercial', 'technical', 'operational'
    agent_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    assigned_to UUID REFERENCES users(id),
    progress_percentage INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT workstream_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    CONSTRAINT progress_range_check CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE INDEX idx_workstreams_deal ON workstreams(deal_id);
CREATE INDEX idx_workstreams_phase ON workstreams(phase_id);
CREATE INDEX idx_workstreams_status ON workstreams(status);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES deal_phases(id) ON DELETE SET NULL,
    workstream_id UUID REFERENCES workstreams(id) ON DELETE SET NULL,

    -- Document metadata
    filename VARCHAR(500) NOT NULL,
    original_path TEXT,
    storage_path TEXT NOT NULL, -- S3/MinIO path
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100),

    -- Classification
    document_type VARCHAR(100), -- 'financial_statement', 'contract', 'presentation', 'code', etc.
    classification_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    tags TEXT[],

    -- Content extraction
    extracted_text TEXT,
    extracted_text_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    page_count INTEGER,

    -- Version control
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id),
    is_latest_version BOOLEAN DEFAULT true,

    -- Vector embeddings reference
    vector_namespace VARCHAR(255), -- For semantic search

    -- Processing status
    processing_status VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'classifying', 'extracting', 'indexed', 'failed'
    processing_error TEXT,

    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    uploaded_by UUID REFERENCES users(id),

    CONSTRAINT processing_status_check CHECK (processing_status IN ('uploaded', 'classifying', 'extracting', 'indexed', 'failed')),
    CONSTRAINT extracted_text_status_check CHECK (extracted_text_status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_documents_deal ON documents(deal_id);
CREATE INDEX idx_documents_workstream ON documents(workstream_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_version ON documents(parent_document_id, version);

-- ============================================================================
-- FINDINGS & ANALYSIS
-- ============================================================================

-- Findings: Structured analysis outputs from agents
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    workstream_id UUID REFERENCES workstreams(id) ON DELETE SET NULL,

    -- Finding content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    finding_type VARCHAR(100) NOT NULL, -- 'insight', 'risk', 'opportunity', 'red_flag'
    category VARCHAR(100), -- Domain-specific categories

    -- Confidence & validation
    confidence_score DECIMAL(3, 2) NOT NULL, -- 0.00 to 1.00
    validation_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'needs_review'

    -- Impact assessment
    impact_level VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
    financial_impact_usd DECIMAL(15, 2),

    -- Agent attribution
    generated_by_agent VARCHAR(100) NOT NULL,
    agent_reasoning TEXT,

    -- Human review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT finding_type_check CHECK (finding_type IN ('insight', 'risk', 'opportunity', 'red_flag', 'data_gap')),
    CONSTRAINT validation_status_check CHECK (validation_status IN ('pending', 'accepted', 'rejected', 'needs_review')),
    CONSTRAINT impact_level_check CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT confidence_range_check CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00)
);

CREATE INDEX idx_findings_deal ON findings(deal_id);
CREATE INDEX idx_findings_workstream ON findings(workstream_id);
CREATE INDEX idx_findings_type ON findings(finding_type);
CREATE INDEX idx_findings_validation ON findings(validation_status);
CREATE INDEX idx_findings_confidence ON findings(confidence_score);
CREATE INDEX idx_findings_impact ON findings(impact_level);

-- Citation chains: Link findings to source documents
CREATE TABLE citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    -- Citation details
    page_number INTEGER,
    excerpt TEXT,
    context TEXT,
    relevance_score DECIMAL(3, 2), -- 0.00 to 1.00

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_citations_finding ON citations(finding_id);
CREATE INDEX idx_citations_document ON citations(document_id);

-- Cross-agent references: Track when agents reference each other's findings
CREATE TABLE inter_agent_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    referenced_finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    reference_type VARCHAR(50) NOT NULL, -- 'supports', 'contradicts', 'elaborates', 'requires'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT reference_type_check CHECK (reference_type IN ('supports', 'contradicts', 'elaborates', 'requires', 'related'))
);

CREATE INDEX idx_inter_agent_refs_source ON inter_agent_references(source_finding_id);
CREATE INDEX idx_inter_agent_refs_target ON inter_agent_references(referenced_finding_id);

-- ============================================================================
-- CONFIGURATION & TEMPLATES
-- ============================================================================

-- Deal-specific configuration
CREATE TABLE deal_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID UNIQUE NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

    -- Agent configurations (JSONB for flexibility)
    agent_configs JSONB DEFAULT '{}'::jsonb,

    -- Phase definitions
    phase_definitions JSONB DEFAULT '{}'::jsonb,

    -- Red flag patterns
    red_flag_patterns JSONB DEFAULT '[]'::jsonb,

    -- Escalation rules
    escalation_rules JSONB DEFAULT '{}'::jsonb,

    -- Custom settings
    custom_settings JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analysis templates
CREATE TABLE analysis_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(100) NOT NULL, -- 'qoe_analysis', 'market_sizing', 'tech_review', etc.
    workstream VARCHAR(100) NOT NULL,

    -- Template content
    template_structure JSONB NOT NULL,
    required_data_points JSONB,

    -- Metadata
    is_system_template BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_type ON analysis_templates(template_type);
CREATE INDEX idx_templates_workstream ON analysis_templates(workstream);

-- ============================================================================
-- AUDIT TRAIL
-- ============================================================================

-- Comprehensive audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

    -- Actor information
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_id VARCHAR(100), -- For agent actions

    -- Action details
    action_type VARCHAR(100) NOT NULL, -- 'document_upload', 'finding_created', 'query_executed', etc.
    entity_type VARCHAR(100), -- 'document', 'finding', 'workstream', etc.
    entity_id UUID,

    -- Action metadata
    action_details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,

    -- Cryptographic verification
    action_hash TEXT NOT NULL, -- SHA-256 hash for immutability
    previous_hash TEXT, -- Chain to previous log entry

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_deal ON audit_logs(deal_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- ANALYSIS WORKFLOWS
-- ============================================================================

-- Analysis plans: Agent-generated plans requiring approval
CREATE TABLE analysis_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    workstream_id UUID REFERENCES workstreams(id) ON DELETE SET NULL,

    -- Plan details
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    methodology TEXT,
    data_sources JSONB,
    estimated_duration_hours INTEGER,

    -- Approval workflow
    status VARCHAR(50) NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'in_progress', 'completed'

    -- Agent information
    generated_by_agent VARCHAR(100) NOT NULL,

    -- Human review
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Execution
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT plan_status_check CHECK (status IN ('pending_review', 'approved', 'rejected', 'in_progress', 'completed', 'aborted'))
);

CREATE INDEX idx_analysis_plans_deal ON analysis_plans(deal_id);
CREATE INDEX idx_analysis_plans_status ON analysis_plans(status);
CREATE INDEX idx_analysis_plans_workstream ON analysis_plans(workstream_id);

-- ============================================================================
-- NOTIFICATIONS & ALERTS
-- ============================================================================

-- Notifications for users
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification content
    notification_type VARCHAR(100) NOT NULL, -- 'red_flag', 'approval_needed', 'finding_ready', etc.
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'

    -- Related entities
    related_entity_type VARCHAR(100),
    related_entity_id UUID,

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Delivery
    delivery_channels TEXT[], -- ['email', 'teams', 'in_app']
    delivered_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notification_priority_check CHECK (priority IN ('critical', 'high', 'normal', 'low'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_deal ON notifications(deal_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- ============================================================================
-- AGENT STATE & CONTEXT
-- ============================================================================

-- Agent sessions: Track agent execution sessions
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    workstream_id UUID REFERENCES workstreams(id) ON DELETE SET NULL,

    agent_type VARCHAR(100) NOT NULL,
    session_status VARCHAR(50) NOT NULL DEFAULT 'active',

    -- Context
    context_data JSONB DEFAULT '{}'::jsonb,

    -- Metrics
    queries_executed INTEGER DEFAULT 0,
    findings_generated INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,

    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT session_status_check CHECK (session_status IN ('active', 'paused', 'completed', 'failed'))
);

CREATE INDEX idx_agent_sessions_deal ON agent_sessions(deal_id);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(session_status);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstreams_updated_at BEFORE UPDATE ON workstreams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_findings_updated_at BEFORE UPDATE ON findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_configs_updated_at BEFORE UPDATE ON deal_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log hash chain function
CREATE OR REPLACE FUNCTION set_audit_log_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash TEXT;
    hash_input TEXT;
BEGIN
    -- Get the most recent hash
    SELECT action_hash INTO last_hash
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 1;

    NEW.previous_hash := last_hash;

    -- Create hash input from all relevant fields
    hash_input := NEW.id::TEXT ||
                  COALESCE(NEW.deal_id::TEXT, '') ||
                  COALESCE(NEW.user_id::TEXT, '') ||
                  NEW.action_type ||
                  NEW.action_details::TEXT ||
                  NEW.created_at::TEXT ||
                  COALESCE(last_hash, '');

    NEW.action_hash := encode(digest(hash_input, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_audit_log_hash_trigger BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION set_audit_log_hash();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Deal summary view
CREATE VIEW deal_summary AS
SELECT
    d.id,
    d.name,
    d.target_company,
    d.deal_type,
    d.status,
    d.current_phase,
    d.created_at,
    COUNT(DISTINCT doc.id) as document_count,
    COUNT(DISTINCT f.id) as finding_count,
    COUNT(DISTINCT CASE WHEN f.finding_type = 'red_flag' THEN f.id END) as red_flag_count,
    AVG(w.progress_percentage) as avg_workstream_progress
FROM deals d
LEFT JOIN documents doc ON doc.deal_id = d.id
LEFT JOIN findings f ON f.deal_id = d.id
LEFT JOIN workstreams w ON w.deal_id = d.id
GROUP BY d.id;

-- Workstream progress view
CREATE VIEW workstream_progress AS
SELECT
    w.id,
    w.deal_id,
    w.name,
    w.status,
    w.progress_percentage,
    COUNT(DISTINCT f.id) as finding_count,
    COUNT(DISTINCT CASE WHEN f.validation_status = 'accepted' THEN f.id END) as accepted_finding_count,
    AVG(f.confidence_score) as avg_confidence_score
FROM workstreams w
LEFT JOIN findings f ON f.workstream_id = w.id
GROUP BY w.id;

-- High priority findings view
CREATE VIEW high_priority_findings AS
SELECT
    f.*,
    d.name as deal_name,
    w.name as workstream_name,
    COUNT(c.id) as citation_count
FROM findings f
JOIN deals d ON d.id = f.deal_id
LEFT JOIN workstreams w ON w.id = f.workstream_id
LEFT JOIN citations c ON c.finding_id = f.id
WHERE f.impact_level IN ('critical', 'high')
   OR f.finding_type = 'red_flag'
GROUP BY f.id, d.name, w.name;
