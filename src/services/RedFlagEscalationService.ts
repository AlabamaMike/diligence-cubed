/**
 * Red Flag Escalation Service
 * Intelligent pattern matching and escalation management for critical findings
 */

import { DatabaseClient } from '../database/client';
import { NotificationService } from './NotificationService';
import { AuditService } from './AuditService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type RedFlagSeverity = 'critical' | 'high' | 'medium' | 'low';

export type EscalationAction =
  | 'notify_partner'
  | 'notify_deal_lead'
  | 'notify_board'
  | 'schedule_review'
  | 'block_phase_transition'
  | 'trigger_expert_review'
  | 'create_follow_up_task';

export interface RedFlagPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  severity: RedFlagSeverity;

  // Pattern matching conditions
  conditions: {
    keywords?: string[];
    numeric_thresholds?: Array<{
      field: string;
      operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
      value: number;
    }>;
    finding_types?: string[];
    agent_sources?: string[];
    confidence_threshold?: number;
    combination_logic?: 'AND' | 'OR'; // How to combine conditions
  };

  // Escalation rules
  escalation_rules: {
    immediate_actions: EscalationAction[];
    sla_hours: number; // Hours until escalation if not addressed
    escalation_chain: Array<{
      role: string;
      delay_hours: number; // Hours before escalating to this level
    }>;
    auto_escalate: boolean;
  };

  // Additional metadata
  metadata?: {
    industry_specific?: string[];
    deal_phase?: string[];
    historical_frequency?: number;
    false_positive_rate?: number;
  };

  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RedFlagInstance {
  id: string;
  deal_id: string;
  pattern_id: string;
  finding_id?: string;
  severity: RedFlagSeverity;
  title: string;
  description: string;
  detected_at: Date;

  // Escalation tracking
  status: 'open' | 'investigating' | 'mitigated' | 'accepted' | 'false_positive' | 'resolved';
  assigned_to?: string;
  escalation_level: number; // Current level in escalation chain
  last_escalated_at?: Date;
  sla_deadline: Date;
  is_overdue: boolean;

  // Resolution
  mitigation_plan?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: Date;

  // Supporting data
  supporting_findings: string[]; // Related finding IDs
  impact_assessment?: {
    financial_impact?: number;
    timeline_impact_days?: number;
    probability_of_occurrence?: number;
  };

  created_at: Date;
  updated_at: Date;
}

export interface EscalationHistory {
  id: string;
  red_flag_id: string;
  escalation_level: number;
  escalated_to_role: string;
  escalated_to_user?: string;
  action_taken: EscalationAction;
  notes?: string;
  created_at: Date;
}

// ============================================================================
// PRE-DEFINED RED FLAG PATTERNS
// ============================================================================

const SYSTEM_RED_FLAG_PATTERNS: Omit<RedFlagPattern, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Revenue Decline Trend',
    category: 'financial',
    description: 'Declining revenue over consecutive periods indicating business deterioration',
    severity: 'critical',
    conditions: {
      keywords: ['revenue decline', 'falling revenue', 'decreasing sales'],
      numeric_thresholds: [
        { field: 'revenue_growth_rate', operator: '<', value: -10 },
      ],
      finding_types: ['financial_metric', 'quality_of_earnings'],
      confidence_threshold: 0.7,
      combination_logic: 'OR',
    },
    escalation_rules: {
      immediate_actions: ['notify_partner', 'notify_deal_lead', 'schedule_review'],
      sla_hours: 24,
      escalation_chain: [
        { role: 'deal_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 24 },
        { role: 'board', delay_hours: 48 },
      ],
      auto_escalate: true,
    },
    metadata: {
      deal_phase: ['discovery', 'deep_dive'],
      historical_frequency: 0.15,
      false_positive_rate: 0.05,
    },
    active: true,
  },
  {
    name: 'Customer Concentration Risk',
    category: 'commercial',
    description: 'Over-reliance on small number of customers poses significant risk',
    severity: 'high',
    conditions: {
      keywords: ['customer concentration', 'top customer', 'revenue concentration'],
      numeric_thresholds: [
        { field: 'top_10_customer_percentage', operator: '>', value: 50 },
      ],
      finding_types: ['commercial_analysis', 'risk_assessment'],
      confidence_threshold: 0.75,
      combination_logic: 'AND',
    },
    escalation_rules: {
      immediate_actions: ['notify_deal_lead', 'trigger_expert_review'],
      sla_hours: 48,
      escalation_chain: [
        { role: 'deal_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 48 },
      ],
      auto_escalate: true,
    },
    metadata: {
      historical_frequency: 0.25,
      false_positive_rate: 0.10,
    },
    active: true,
  },
  {
    name: 'Critical Security Vulnerability',
    category: 'technical',
    description: 'High or critical severity security vulnerabilities detected',
    severity: 'critical',
    conditions: {
      keywords: ['critical vulnerability', 'security breach', 'exploit', 'cve'],
      finding_types: ['security_assessment', 'technical_analysis'],
      agent_sources: ['technical'],
      confidence_threshold: 0.8,
      combination_logic: 'AND',
    },
    escalation_rules: {
      immediate_actions: ['notify_partner', 'trigger_expert_review', 'block_phase_transition'],
      sla_hours: 12,
      escalation_chain: [
        { role: 'tech_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 12 },
        { role: 'board', delay_hours: 24 },
      ],
      auto_escalate: true,
    },
    metadata: {
      industry_specific: ['technology', 'saas'],
      historical_frequency: 0.08,
      false_positive_rate: 0.03,
    },
    active: true,
  },
  {
    name: 'Negative EBITDA',
    category: 'financial',
    description: 'Company operating at a loss with negative adjusted EBITDA',
    severity: 'high',
    conditions: {
      keywords: ['negative ebitda', 'operating loss', 'unprofitable'],
      numeric_thresholds: [
        { field: 'adjusted_ebitda', operator: '<', value: 0 },
      ],
      finding_types: ['financial_metric', 'quality_of_earnings'],
      confidence_threshold: 0.9,
      combination_logic: 'OR',
    },
    escalation_rules: {
      immediate_actions: ['notify_partner', 'schedule_review'],
      sla_hours: 36,
      escalation_chain: [
        { role: 'deal_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 36 },
      ],
      auto_escalate: true,
    },
    metadata: {
      deal_phase: ['discovery', 'deep_dive'],
      historical_frequency: 0.12,
      false_positive_rate: 0.02,
    },
    active: true,
  },
  {
    name: 'Legal or Compliance Issue',
    category: 'legal',
    description: 'Pending litigation, regulatory investigation, or compliance violations',
    severity: 'critical',
    conditions: {
      keywords: [
        'litigation',
        'lawsuit',
        'regulatory investigation',
        'compliance violation',
        'sec investigation',
        'ftc',
      ],
      finding_types: ['legal_review', 'risk_assessment'],
      confidence_threshold: 0.7,
      combination_logic: 'OR',
    },
    escalation_rules: {
      immediate_actions: [
        'notify_partner',
        'notify_board',
        'trigger_expert_review',
        'block_phase_transition',
      ],
      sla_hours: 12,
      escalation_chain: [
        { role: 'legal_counsel', delay_hours: 0 },
        { role: 'partner', delay_hours: 8 },
        { role: 'board', delay_hours: 12 },
      ],
      auto_escalate: true,
    },
    metadata: {
      historical_frequency: 0.05,
      false_positive_rate: 0.08,
    },
    active: true,
  },
  {
    name: 'Key Person Dependency',
    category: 'operational',
    description: 'Critical dependency on single individual or small team',
    severity: 'medium',
    conditions: {
      keywords: ['key person risk', 'founder dependency', 'single point of failure'],
      finding_types: ['operational_analysis', 'org_assessment'],
      confidence_threshold: 0.65,
      combination_logic: 'OR',
    },
    escalation_rules: {
      immediate_actions: ['notify_deal_lead', 'create_follow_up_task'],
      sla_hours: 72,
      escalation_chain: [
        { role: 'deal_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 72 },
      ],
      auto_escalate: false,
    },
    metadata: {
      historical_frequency: 0.35,
      false_positive_rate: 0.15,
    },
    active: true,
  },
  {
    name: 'High Churn Rate',
    category: 'commercial',
    description: 'Customer churn rate significantly above industry benchmarks',
    severity: 'high',
    conditions: {
      keywords: ['high churn', 'customer attrition', 'retention issues'],
      numeric_thresholds: [
        { field: 'annual_churn_rate', operator: '>', value: 25 },
      ],
      finding_types: ['commercial_analysis', 'customer_metrics'],
      confidence_threshold: 0.75,
      combination_logic: 'AND',
    },
    escalation_rules: {
      immediate_actions: ['notify_deal_lead', 'schedule_review'],
      sla_hours: 48,
      escalation_chain: [
        { role: 'deal_lead', delay_hours: 0 },
        { role: 'partner', delay_hours: 48 },
      ],
      auto_escalate: true,
    },
    metadata: {
      industry_specific: ['saas', 'subscription'],
      historical_frequency: 0.18,
      false_positive_rate: 0.12,
    },
    active: true,
  },
];

// ============================================================================
// RED FLAG ESCALATION SERVICE
// ============================================================================

export class RedFlagEscalationService extends EventEmitter {
  private notificationService: NotificationService;
  private auditService: AuditService;

  constructor(private db: DatabaseClient) {
    super();
    this.notificationService = new NotificationService(db);
    this.auditService = new AuditService(db);
    this.initializeDatabase();
  }

  /**
   * Initialize database tables
   */
  private async initializeDatabase(): Promise<void> {
    // Create red_flag_patterns table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS red_flag_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        severity VARCHAR(20) NOT NULL,
        conditions JSONB NOT NULL,
        escalation_rules JSONB NOT NULL,
        metadata JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_red_flag_patterns_category (category),
        INDEX idx_red_flag_patterns_severity (severity),
        INDEX idx_red_flag_patterns_active (active)
      );
    `);

    // Create red_flag_instances table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS red_flag_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        pattern_id UUID NOT NULL REFERENCES red_flag_patterns(id),
        finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        assigned_to VARCHAR(100),
        escalation_level INTEGER DEFAULT 0,
        last_escalated_at TIMESTAMPTZ,
        sla_deadline TIMESTAMPTZ NOT NULL,
        is_overdue BOOLEAN DEFAULT false,
        mitigation_plan TEXT,
        resolution_notes TEXT,
        resolved_by VARCHAR(100),
        resolved_at TIMESTAMPTZ,
        supporting_findings JSONB DEFAULT '[]',
        impact_assessment JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_red_flag_instances_deal (deal_id),
        INDEX idx_red_flag_instances_status (status),
        INDEX idx_red_flag_instances_severity (severity),
        INDEX idx_red_flag_instances_overdue (is_overdue)
      );
    `);

    // Create escalation_history table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS escalation_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        red_flag_id UUID NOT NULL REFERENCES red_flag_instances(id) ON DELETE CASCADE,
        escalation_level INTEGER NOT NULL,
        escalated_to_role VARCHAR(100) NOT NULL,
        escalated_to_user VARCHAR(100),
        action_taken VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_escalation_history_red_flag (red_flag_id)
      );
    `);

    logger.info('Red flag escalation database initialized');
  }

  /**
   * Seed system red flag patterns
   */
  async seedSystemPatterns(): Promise<void> {
    logger.info('Seeding system red flag patterns');

    for (const pattern of SYSTEM_RED_FLAG_PATTERNS) {
      const existing = await this.db.query(
        'SELECT id FROM red_flag_patterns WHERE name = $1',
        [pattern.name]
      );

      if (existing.rows.length === 0) {
        await this.db.query(
          `INSERT INTO red_flag_patterns
           (name, category, description, severity, conditions, escalation_rules, metadata, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            pattern.name,
            pattern.category,
            pattern.description,
            pattern.severity,
            JSON.stringify(pattern.conditions),
            JSON.stringify(pattern.escalation_rules),
            JSON.stringify(pattern.metadata || {}),
            pattern.active,
          ]
        );
        logger.info('Seeded red flag pattern', { name: pattern.name });
      }
    }
  }

  // ==========================================================================
  // PATTERN MATCHING & DETECTION
  // ==========================================================================

  /**
   * Scan finding for red flag patterns
   */
  async scanFinding(
    findingId: string,
    dealId: string
  ): Promise<RedFlagInstance[]> {
    logger.info('Scanning finding for red flags', { findingId, dealId });

    // Get finding details
    const findingResult = await this.db.query<{
      title: string;
      description: string;
      category: string;
      generated_by_agent: string;
      confidence_score: number;
      impact_level: string;
      metadata: any;
    }>(
      'SELECT title, description, category, generated_by_agent, confidence_score, impact_level, metadata FROM findings WHERE id = $1',
      [findingId]
    );

    if (findingResult.rows.length === 0) {
      return [];
    }

    const finding = findingResult.rows[0];

    // Get active patterns
    const patternsResult = await this.db.query<RedFlagPattern>(
      'SELECT * FROM red_flag_patterns WHERE active = true'
    );

    const detectedFlags: RedFlagInstance[] = [];

    for (const patternRow of patternsResult.rows) {
      const pattern = this.deserializePattern(patternRow);

      // Check if pattern matches
      if (this.matchesPattern(finding, pattern)) {
        logger.info('Red flag pattern matched', {
          findingId,
          patternName: pattern.name,
        });

        // Create red flag instance
        const flagId = await this.createRedFlagInstance(
          dealId,
          pattern.id,
          findingId,
          pattern.severity,
          `${pattern.name}: ${finding.title}`,
          finding.description,
          pattern.escalation_rules.sla_hours
        );

        const flag = await this.getRedFlagInstance(flagId);
        if (flag) {
          detectedFlags.push(flag);

          // Trigger immediate escalation actions
          await this.executeEscalationActions(
            flag,
            pattern.escalation_rules.immediate_actions
          );
        }
      }
    }

    return detectedFlags;
  }

  /**
   * Check if finding matches pattern
   */
  private matchesPattern(finding: any, pattern: RedFlagPattern): boolean {
    const { conditions } = pattern;
    const matches: boolean[] = [];

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const text = `${finding.title} ${finding.description}`.toLowerCase();
      const keywordMatch = conditions.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase())
      );
      matches.push(keywordMatch);
    }

    // Check finding types
    if (conditions.finding_types && conditions.finding_types.length > 0) {
      matches.push(conditions.finding_types.includes(finding.category));
    }

    // Check agent sources
    if (conditions.agent_sources && conditions.agent_sources.length > 0) {
      matches.push(conditions.agent_sources.includes(finding.generated_by_agent));
    }

    // Check confidence threshold
    if (conditions.confidence_threshold !== undefined) {
      matches.push(finding.confidence_score >= conditions.confidence_threshold);
    }

    // Check numeric thresholds
    if (conditions.numeric_thresholds && conditions.numeric_thresholds.length > 0) {
      const metadata = typeof finding.metadata === 'string'
        ? JSON.parse(finding.metadata)
        : finding.metadata || {};

      for (const threshold of conditions.numeric_thresholds) {
        const value = metadata[threshold.field];
        if (value !== undefined && value !== null) {
          const thresholdMatch = this.evaluateNumericThreshold(
            value,
            threshold.operator,
            threshold.value
          );
          matches.push(thresholdMatch);
        }
      }
    }

    // Apply combination logic
    if (matches.length === 0) {
      return false;
    }

    return conditions.combination_logic === 'AND'
      ? matches.every((m) => m)
      : matches.some((m) => m);
  }

  private evaluateNumericThreshold(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  // ==========================================================================
  // RED FLAG INSTANCE MANAGEMENT
  // ==========================================================================

  /**
   * Create red flag instance
   */
  private async createRedFlagInstance(
    dealId: string,
    patternId: string,
    findingId: string | undefined,
    severity: RedFlagSeverity,
    title: string,
    description: string,
    slaHours: number
  ): Promise<string> {
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO red_flag_instances
       (deal_id, pattern_id, finding_id, severity, title, description, sla_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [dealId, patternId, findingId || null, severity, title, description, slaDeadline]
    );

    const flagId = result.rows[0].id;

    // Audit log
    await this.auditService.log(
      dealId,
      'system',
      'red_flag_detected',
      { red_flag_id: flagId, severity, title },
      { pattern_id: patternId }
    );

    // Emit event
    this.emit('red_flag_detected', {
      id: flagId,
      deal_id: dealId,
      severity,
      title,
    });

    logger.info('Red flag instance created', { flagId, severity });
    return flagId;
  }

  /**
   * Get red flag instance
   */
  async getRedFlagInstance(flagId: string): Promise<RedFlagInstance | null> {
    const result = await this.db.query<RedFlagInstance>(
      'SELECT * FROM red_flag_instances WHERE id = $1',
      [flagId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserializeRedFlag(result.rows[0]);
  }

  /**
   * List red flags for a deal
   */
  async listRedFlags(
    dealId: string,
    filters?: {
      status?: string;
      severity?: RedFlagSeverity;
      overdue_only?: boolean;
    }
  ): Promise<RedFlagInstance[]> {
    let query = 'SELECT * FROM red_flag_instances WHERE deal_id = $1';
    const params: any[] = [dealId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters?.overdue_only) {
      query += ' AND is_overdue = true';
    }

    query += ' ORDER BY severity DESC, detected_at DESC';

    const result = await this.db.query<RedFlagInstance>(query, params);

    return result.rows.map((row) => this.deserializeRedFlag(row));
  }

  /**
   * Update red flag status
   */
  async updateRedFlagStatus(
    flagId: string,
    status: RedFlagInstance['status'],
    notes?: string
  ): Promise<void> {
    logger.info('Updating red flag status', { flagId, status });

    await this.db.query(
      `UPDATE red_flag_instances
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, flagId]
    );

    // If resolved, set resolution timestamp
    if (status === 'resolved' || status === 'false_positive') {
      await this.db.query(
        `UPDATE red_flag_instances
         SET resolved_at = NOW(), resolution_notes = $1
         WHERE id = $2`,
        [notes || null, flagId]
      );
    }

    // Audit log
    const flag = await this.getRedFlagInstance(flagId);
    if (flag) {
      await this.auditService.log(
        flag.deal_id,
        'system',
        'red_flag_status_updated',
        { red_flag_id: flagId, status, notes },
        {}
      );
    }
  }

  /**
   * Assign red flag to user
   */
  async assignRedFlag(flagId: string, userId: string): Promise<void> {
    logger.info('Assigning red flag', { flagId, userId });

    await this.db.query(
      `UPDATE red_flag_instances
       SET assigned_to = $1, status = 'investigating', updated_at = NOW()
       WHERE id = $2`,
      [userId, flagId]
    );

    // Send notification to assigned user
    const flag = await this.getRedFlagInstance(flagId);
    if (flag) {
      await this.notificationService.create(
        flag.deal_id,
        userId,
        'red_flag_assigned',
        `Red flag assigned: ${flag.title}`,
        { red_flag_id: flagId, severity: flag.severity },
        'high'
      );
    }
  }

  // ==========================================================================
  // ESCALATION LOGIC
  // ==========================================================================

  /**
   * Execute immediate escalation actions
   */
  private async executeEscalationActions(
    flag: RedFlagInstance,
    actions: EscalationAction[]
  ): Promise<void> {
    logger.info('Executing escalation actions', {
      flagId: flag.id,
      actions,
    });

    for (const action of actions) {
      try {
        switch (action) {
          case 'notify_partner':
            await this.notifyRole(flag, 'partner');
            break;
          case 'notify_deal_lead':
            await this.notifyRole(flag, 'deal_lead');
            break;
          case 'notify_board':
            await this.notifyRole(flag, 'board');
            break;
          case 'schedule_review':
            await this.scheduleReview(flag);
            break;
          case 'block_phase_transition':
            await this.blockPhaseTransition(flag);
            break;
          case 'trigger_expert_review':
            await this.triggerExpertReview(flag);
            break;
          case 'create_follow_up_task':
            await this.createFollowUpTask(flag);
            break;
        }

        // Record in escalation history
        await this.recordEscalation(flag.id, flag.escalation_level, action, action);
      } catch (error) {
        logger.error('Failed to execute escalation action', {
          action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Notify specific role about red flag
   */
  private async notifyRole(flag: RedFlagInstance, role: string): Promise<void> {
    // Get users with this role for the deal
    const usersResult = await this.db.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM deal_access
       WHERE deal_id = $1 AND role = $2`,
      [flag.deal_id, role]
    );

    for (const user of usersResult.rows) {
      await this.notificationService.create(
        flag.deal_id,
        user.user_id,
        'red_flag_detected',
        `🚩 ${flag.severity.toUpperCase()}: ${flag.title}`,
        {
          red_flag_id: flag.id,
          severity: flag.severity,
          sla_deadline: flag.sla_deadline.toISOString(),
        },
        flag.severity === 'critical' ? 'critical' : 'high'
      );
    }
  }

  private async scheduleReview(flag: RedFlagInstance): Promise<void> {
    // Create calendar event or task (implementation depends on calendar integration)
    logger.info('Scheduling review for red flag', { flagId: flag.id });
  }

  private async blockPhaseTransition(flag: RedFlagInstance): Promise<void> {
    // Update deal config to block phase transitions until resolved
    await this.db.query(
      `INSERT INTO deal_configs (deal_id, config_data)
       VALUES ($1, $2)
       ON CONFLICT (deal_id) DO UPDATE
       SET config_data = deal_configs.config_data || $2`,
      [
        flag.deal_id,
        JSON.stringify({
          phase_transition_blocked: true,
          blocking_red_flag_id: flag.id,
        }),
      ]
    );
  }

  private async triggerExpertReview(flag: RedFlagInstance): Promise<void> {
    // Create expert review request (could integrate with external systems)
    logger.info('Triggering expert review', { flagId: flag.id });
  }

  private async createFollowUpTask(flag: RedFlagInstance): Promise<void> {
    // Create task in task management system
    logger.info('Creating follow-up task', { flagId: flag.id });
  }

  /**
   * Record escalation in history
   */
  private async recordEscalation(
    flagId: string,
    level: number,
    role: string,
    action: EscalationAction,
    userId?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO escalation_history
       (red_flag_id, escalation_level, escalated_to_role, escalated_to_user, action_taken)
       VALUES ($1, $2, $3, $4, $5)`,
      [flagId, level, role, userId || null, action]
    );
  }

  /**
   * Check for overdue red flags and auto-escalate
   */
  async processOverdueRedFlags(): Promise<void> {
    logger.info('Processing overdue red flags');

    // Find overdue flags
    const overdueResult = await this.db.query<RedFlagInstance>(
      `SELECT * FROM red_flag_instances
       WHERE status IN ('open', 'investigating')
       AND sla_deadline < NOW()
       AND is_overdue = false`
    );

    for (const flagRow of overdueResult.rows) {
      const flag = this.deserializeRedFlag(flagRow);

      // Mark as overdue
      await this.db.query(
        'UPDATE red_flag_instances SET is_overdue = true WHERE id = $1',
        [flag.id]
      );

      // Get pattern for escalation rules
      const pattern = await this.getPattern(flag.pattern_id);
      if (pattern && pattern.escalation_rules.auto_escalate) {
        await this.escalateToNextLevel(flag, pattern);
      }
    }
  }

  /**
   * Escalate to next level in chain
   */
  private async escalateToNextLevel(
    flag: RedFlagInstance,
    pattern: RedFlagPattern
  ): Promise<void> {
    const nextLevel = flag.escalation_level + 1;

    if (nextLevel < pattern.escalation_rules.escalation_chain.length) {
      const nextChainItem = pattern.escalation_rules.escalation_chain[nextLevel];

      logger.info('Escalating red flag to next level', {
        flagId: flag.id,
        level: nextLevel,
        role: nextChainItem.role,
      });

      await this.db.query(
        `UPDATE red_flag_instances
         SET escalation_level = $1, last_escalated_at = NOW()
         WHERE id = $2`,
        [nextLevel, flag.id]
      );

      await this.notifyRole(flag, nextChainItem.role);
      await this.recordEscalation(flag.id, nextLevel, nextChainItem.role, 'notify_' + nextChainItem.role as EscalationAction);
    }
  }

  // ==========================================================================
  // PATTERN MANAGEMENT
  // ==========================================================================

  async getPattern(patternId: string): Promise<RedFlagPattern | null> {
    const result = await this.db.query<RedFlagPattern>(
      'SELECT * FROM red_flag_patterns WHERE id = $1',
      [patternId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserializePattern(result.rows[0]);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private deserializePattern(row: any): RedFlagPattern {
    return {
      ...row,
      conditions: typeof row.conditions === 'string'
        ? JSON.parse(row.conditions)
        : row.conditions,
      escalation_rules: typeof row.escalation_rules === 'string'
        ? JSON.parse(row.escalation_rules)
        : row.escalation_rules,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    };
  }

  private deserializeRedFlag(row: any): RedFlagInstance {
    return {
      ...row,
      supporting_findings: typeof row.supporting_findings === 'string'
        ? JSON.parse(row.supporting_findings)
        : row.supporting_findings || [],
      impact_assessment: typeof row.impact_assessment === 'string'
        ? JSON.parse(row.impact_assessment)
        : row.impact_assessment,
    };
  }
}
