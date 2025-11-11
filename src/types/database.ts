/**
 * Database Entity Types
 * TypeScript types matching PostgreSQL schema
 */

// ============================================================================
// CORE ENTITIES
// ============================================================================

export type DealType = 'acquisition' | 'investment' | 'merger' | 'other';
export type DealStatus = 'active' | 'completed' | 'archived' | 'on_hold';
export type DealPhase = 'discovery' | 'deep_dive' | 'validation' | 'synthesis' | 'completed';

export interface Deal {
  id: string;
  name: string;
  target_company: string;
  deal_type: DealType;
  status: DealStatus;
  current_phase: DealPhase;

  deal_size_usd?: number;
  target_industry?: string;
  target_region?: string;

  encryption_key_id: string;

  created_at: Date;
  updated_at: Date;
  target_close_date?: Date;

  created_by: string;
}

// ============================================================================
// USER MANAGEMENT & RBAC
// ============================================================================

export type UserRole = 'partner' | 'manager' | 'lead' | 'analyst' | 'client_viewer' | 'auditor' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;

  api_key_hash?: string;
  last_login?: Date;

  created_at: Date;
  updated_at: Date;
}

export type AccessLevel = 'full' | 'workstream_specific' | 'read_only';

export interface DealAccess {
  id: string;
  deal_id: string;
  user_id: string;
  access_level: AccessLevel;
  workstreams?: string[];

  granted_at: Date;
  granted_by?: string;
  expires_at?: Date;
}

// ============================================================================
// DOCUMENT REPOSITORY
// ============================================================================

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface DealPhaseRecord {
  id: string;
  deal_id: string;
  phase_name: string;
  phase_order: number;
  status: PhaseStatus;

  started_at?: Date;
  completed_at?: Date;
}

export type WorkstreamStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface Workstream {
  id: string;
  deal_id: string;
  phase_id?: string;
  name: string;
  agent_type: string;
  status: WorkstreamStatus;

  assigned_to?: string;
  progress_percentage: number;

  created_at: Date;
  updated_at: Date;
}

export type ProcessingStatus = 'uploaded' | 'classifying' | 'extracting' | 'indexed' | 'failed';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  deal_id: string;
  phase_id?: string;
  workstream_id?: string;

  // Metadata
  filename: string;
  original_path?: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type?: string;

  // Classification
  document_type?: string;
  classification_confidence?: number;
  tags?: string[];

  // Content
  extracted_text?: string;
  extracted_text_status: ExtractionStatus;
  page_count?: number;

  // Versioning
  version: number;
  parent_document_id?: string;
  is_latest_version: boolean;

  // Vector embeddings
  vector_namespace?: string;

  // Processing
  processing_status: ProcessingStatus;
  processing_error?: string;

  // Timestamps
  uploaded_at: Date;
  processed_at?: Date;
  uploaded_by?: string;
}

// ============================================================================
// FINDINGS & ANALYSIS
// ============================================================================

export type FindingType = 'insight' | 'risk' | 'opportunity' | 'red_flag' | 'data_gap';
export type ValidationStatus = 'pending' | 'accepted' | 'rejected' | 'needs_review';
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  deal_id: string;
  workstream_id?: string;

  // Content
  title: string;
  description: string;
  finding_type: FindingType;
  category?: string;

  // Confidence & validation
  confidence_score: number; // 0.00 to 1.00
  validation_status: ValidationStatus;

  // Impact
  impact_level?: ImpactLevel;
  financial_impact_usd?: number;

  // Agent attribution
  generated_by_agent: string;
  agent_reasoning?: string;

  // Human review
  reviewed_by?: string;
  reviewed_at?: Date;
  reviewer_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface Citation {
  id: string;
  finding_id: string;
  document_id: string;

  page_number?: number;
  excerpt?: string;
  context?: string;
  relevance_score?: number; // 0.00 to 1.00

  created_at: Date;
}

export type ReferenceType = 'supports' | 'contradicts' | 'elaborates' | 'requires' | 'related';

export interface InterAgentReference {
  id: string;
  source_finding_id: string;
  referenced_finding_id: string;
  reference_type: ReferenceType;

  created_at: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface DealConfig {
  id: string;
  deal_id: string;

  agent_configs: Record<string, any>;
  phase_definitions: Record<string, any>;
  red_flag_patterns: any[];
  escalation_rules: Record<string, any>;
  custom_settings: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export interface AnalysisTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  workstream: string;

  template_structure: Record<string, any>;
  required_data_points?: Record<string, any>;

  is_system_template: boolean;
  created_by?: string;

  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export interface AuditLog {
  id: string;
  deal_id?: string;

  // Actor
  user_id?: string;
  agent_id?: string;

  // Action
  action_type: string;
  entity_type?: string;
  entity_id?: string;

  // Metadata
  action_details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;

  // Cryptographic verification
  action_hash: string;
  previous_hash?: string;

  created_at: Date;
}

// ============================================================================
// WORKFLOWS
// ============================================================================

export type AnalysisPlanStatus = 'pending_review' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'aborted';

export interface AnalysisPlan {
  id: string;
  deal_id: string;
  workstream_id?: string;

  // Plan details
  title: string;
  description: string;
  methodology?: string;
  data_sources?: Record<string, any>;
  estimated_duration_hours?: number;

  // Status
  status: AnalysisPlanStatus;

  // Agent info
  generated_by_agent: string;

  // Review
  submitted_at: Date;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;

  // Execution
  started_at?: Date;
  completed_at?: Date;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Notification {
  id: string;
  deal_id?: string;
  user_id: string;

  notification_type: string;
  title: string;
  message: string;
  priority: NotificationPriority;

  related_entity_type?: string;
  related_entity_id?: string;

  is_read: boolean;
  read_at?: Date;

  delivery_channels?: string[];
  delivered_at?: Date;

  created_at: Date;
}

// ============================================================================
// AGENT STATE
// ============================================================================

export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface AgentSession {
  id: string;
  deal_id: string;
  workstream_id?: string;

  agent_type: string;
  session_status: SessionStatus;

  context_data: Record<string, any>;

  // Metrics
  queries_executed: number;
  findings_generated: number;
  documents_processed: number;

  started_at: Date;
  last_activity_at: Date;
  ended_at?: Date;
}

// ============================================================================
// VIEWS
// ============================================================================

export interface DealSummary {
  id: string;
  name: string;
  target_company: string;
  deal_type: DealType;
  status: DealStatus;
  current_phase: DealPhase;
  created_at: Date;
  document_count: number;
  finding_count: number;
  red_flag_count: number;
  avg_workstream_progress: number;
}

export interface WorkstreamProgress {
  id: string;
  deal_id: string;
  name: string;
  status: WorkstreamStatus;
  progress_percentage: number;
  finding_count: number;
  accepted_finding_count: number;
  avg_confidence_score: number;
}

export interface HighPriorityFinding extends Finding {
  deal_name: string;
  workstream_name?: string;
  citation_count: number;
}
