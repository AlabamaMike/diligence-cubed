/**
 * Configuration Service
 * Manages deal-specific configurations and templates
 */

import { DatabaseClient } from '../database/client';
import { DealConfig, AnalysisTemplate } from '../types/database';
import { logger } from '../utils/logger';

export interface AgentConfig {
  enabled: boolean;
  priority?: number;
  custom_prompts?: Record<string, string>;
  parameters?: Record<string, any>;
}

export interface PhaseDefinition {
  name: string;
  order: number;
  required_workstreams: string[];
  transition_criteria: Record<string, any>;
  estimated_duration_days?: number;
}

export interface RedFlagPattern {
  pattern_type: string;
  keywords: string[];
  threshold?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  auto_escalate: boolean;
}

export interface EscalationRule {
  trigger_type: string;
  conditions: Record<string, any>;
  notify_roles: string[];
  escalation_delay_hours?: number;
}

export class ConfigService {
  constructor(private db: DatabaseClient) {}

  // ============================================================================
  // DEAL CONFIGURATION
  // ============================================================================

  /**
   * Initialize configuration for a new deal
   */
  async initializeDealConfig(dealId: string): Promise<DealConfig> {
    const defaultConfig = {
      agent_configs: this.getDefaultAgentConfigs(),
      phase_definitions: this.getDefaultPhaseDefinitions(),
      red_flag_patterns: this.getDefaultRedFlagPatterns(),
      escalation_rules: this.getDefaultEscalationRules(),
      custom_settings: {},
    };

    const query = `
      INSERT INTO deal_configs (
        deal_id, agent_configs, phase_definitions,
        red_flag_patterns, escalation_rules, custom_settings
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [
      dealId,
      JSON.stringify(defaultConfig.agent_configs),
      JSON.stringify(defaultConfig.phase_definitions),
      JSON.stringify(defaultConfig.red_flag_patterns),
      JSON.stringify(defaultConfig.escalation_rules),
      JSON.stringify(defaultConfig.custom_settings),
    ]);

    logger.info('Deal configuration initialized', { dealId });
    return result.rows[0];
  }

  /**
   * Get deal configuration
   */
  async getDealConfig(dealId: string): Promise<DealConfig | null> {
    const query = 'SELECT * FROM deal_configs WHERE deal_id = $1';
    const result = await this.db.query<DealConfig>(query, [dealId]);
    return result.rows[0] || null;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(
    dealId: string,
    agentType: string,
    config: AgentConfig
  ): Promise<DealConfig | null> {
    const query = `
      UPDATE deal_configs
      SET agent_configs = jsonb_set(
        agent_configs,
        $2,
        $3::jsonb,
        true
      )
      WHERE deal_id = $1
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [
      dealId,
      `{${agentType}}`,
      JSON.stringify(config),
    ]);

    logger.info('Agent configuration updated', { dealId, agentType });
    return result.rows[0] || null;
  }

  /**
   * Update phase definitions
   */
  async updatePhaseDefinitions(
    dealId: string,
    phases: Record<string, PhaseDefinition>
  ): Promise<DealConfig | null> {
    const query = `
      UPDATE deal_configs
      SET phase_definitions = $2::jsonb
      WHERE deal_id = $1
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [dealId, JSON.stringify(phases)]);
    logger.info('Phase definitions updated', { dealId });
    return result.rows[0] || null;
  }

  /**
   * Add red flag pattern
   */
  async addRedFlagPattern(dealId: string, pattern: RedFlagPattern): Promise<DealConfig | null> {
    const query = `
      UPDATE deal_configs
      SET red_flag_patterns = red_flag_patterns || $2::jsonb
      WHERE deal_id = $1
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [dealId, JSON.stringify([pattern])]);
    logger.info('Red flag pattern added', { dealId, patternType: pattern.pattern_type });
    return result.rows[0] || null;
  }

  /**
   * Update escalation rules
   */
  async updateEscalationRules(
    dealId: string,
    rules: Record<string, EscalationRule>
  ): Promise<DealConfig | null> {
    const query = `
      UPDATE deal_configs
      SET escalation_rules = $2::jsonb
      WHERE deal_id = $1
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [dealId, JSON.stringify(rules)]);
    logger.info('Escalation rules updated', { dealId });
    return result.rows[0] || null;
  }

  /**
   * Update custom settings
   */
  async updateCustomSettings(
    dealId: string,
    settings: Record<string, any>
  ): Promise<DealConfig | null> {
    const query = `
      UPDATE deal_configs
      SET custom_settings = $2::jsonb
      WHERE deal_id = $1
      RETURNING *
    `;

    const result = await this.db.query<DealConfig>(query, [dealId, JSON.stringify(settings)]);
    return result.rows[0] || null;
  }

  // ============================================================================
  // ANALYSIS TEMPLATES
  // ============================================================================

  /**
   * Create analysis template
   */
  async createTemplate(
    name: string,
    description: string,
    templateType: string,
    workstream: string,
    structure: Record<string, any>,
    requiredDataPoints?: Record<string, any>,
    createdBy?: string,
    isSystemTemplate = false
  ): Promise<AnalysisTemplate> {
    const query = `
      INSERT INTO analysis_templates (
        name, description, template_type, workstream,
        template_structure, required_data_points,
        is_system_template, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await this.db.query<AnalysisTemplate>(query, [
      name,
      description,
      templateType,
      workstream,
      JSON.stringify(structure),
      requiredDataPoints ? JSON.stringify(requiredDataPoints) : null,
      isSystemTemplate,
      createdBy,
    ]);

    logger.info('Analysis template created', { templateId: result.rows[0].id, name });
    return result.rows[0];
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<AnalysisTemplate | null> {
    const query = 'SELECT * FROM analysis_templates WHERE id = $1';
    const result = await this.db.query<AnalysisTemplate>(query, [templateId]);
    return result.rows[0] || null;
  }

  /**
   * Get templates by workstream
   */
  async getTemplatesByWorkstream(workstream: string): Promise<AnalysisTemplate[]> {
    const query = `
      SELECT * FROM analysis_templates
      WHERE workstream = $1
      ORDER BY is_system_template DESC, created_at DESC
    `;

    const result = await this.db.query<AnalysisTemplate>(query, [workstream]);
    return result.rows;
  }

  /**
   * Get templates by type
   */
  async getTemplatesByType(templateType: string): Promise<AnalysisTemplate[]> {
    const query = `
      SELECT * FROM analysis_templates
      WHERE template_type = $1
      ORDER BY is_system_template DESC, created_at DESC
    `;

    const result = await this.db.query<AnalysisTemplate>(query, [templateType]);
    return result.rows;
  }

  /**
   * Get all system templates
   */
  async getSystemTemplates(): Promise<AnalysisTemplate[]> {
    const query = `
      SELECT * FROM analysis_templates
      WHERE is_system_template = true
      ORDER BY workstream, template_type
    `;

    const result = await this.db.query<AnalysisTemplate>(query);
    return result.rows;
  }

  // ============================================================================
  // DEFAULT CONFIGURATIONS
  // ============================================================================

  private getDefaultAgentConfigs(): Record<string, AgentConfig> {
    return {
      orchestrator: {
        enabled: true,
        priority: 1,
        parameters: {
          max_parallel_workstreams: 4,
          phase_transition_auto_approve: false,
        },
      },
      ingestion: {
        enabled: true,
        priority: 2,
        parameters: {
          auto_classify: true,
          ocr_enabled: true,
          max_document_size_mb: 50,
        },
      },
      financial: {
        enabled: true,
        priority: 3,
        parameters: {
          qoe_analysis_depth: 'comprehensive',
          auto_generate_models: true,
        },
      },
      commercial: {
        enabled: true,
        priority: 3,
        parameters: {
          market_research_depth: 'standard',
          competitor_count: 5,
        },
      },
      technical: {
        enabled: true,
        priority: 3,
        parameters: {
          code_analysis_enabled: true,
          security_scan_enabled: true,
        },
      },
      operational: {
        enabled: true,
        priority: 3,
        parameters: {
          org_analysis_enabled: true,
          supply_chain_analysis: true,
        },
      },
    };
  }

  private getDefaultPhaseDefinitions(): Record<string, PhaseDefinition> {
    return {
      discovery: {
        name: 'Discovery',
        order: 1,
        required_workstreams: ['ingestion'],
        transition_criteria: {
          min_documents_processed: 10,
          classification_complete: true,
        },
        estimated_duration_days: 3,
      },
      deep_dive: {
        name: 'Deep Dive',
        order: 2,
        required_workstreams: ['financial', 'commercial', 'technical', 'operational'],
        transition_criteria: {
          min_findings_per_workstream: 5,
          all_workstreams_progress: 70,
        },
        estimated_duration_days: 7,
      },
      validation: {
        name: 'Validation',
        order: 3,
        required_workstreams: ['financial', 'commercial', 'technical', 'operational'],
        transition_criteria: {
          findings_validation_rate: 0.8,
          red_flags_reviewed: true,
        },
        estimated_duration_days: 3,
      },
      synthesis: {
        name: 'Synthesis',
        order: 4,
        required_workstreams: ['orchestrator'],
        transition_criteria: {
          report_generated: true,
          executive_summary_approved: true,
        },
        estimated_duration_days: 2,
      },
    };
  }

  private getDefaultRedFlagPatterns(): RedFlagPattern[] {
    return [
      {
        pattern_type: 'financial_deterioration',
        keywords: ['declining revenue', 'negative ebitda', 'cash flow issues', 'covenant breach'],
        threshold: 0.7,
        severity: 'critical',
        auto_escalate: true,
      },
      {
        pattern_type: 'legal_issues',
        keywords: ['litigation', 'lawsuit', 'regulatory investigation', 'compliance violation'],
        severity: 'high',
        auto_escalate: true,
      },
      {
        pattern_type: 'customer_concentration',
        keywords: ['top customer', 'revenue concentration', 'single customer'],
        threshold: 0.3,
        severity: 'high',
        auto_escalate: false,
      },
      {
        pattern_type: 'technical_debt',
        keywords: ['legacy system', 'outdated technology', 'technical debt', 'scalability issues'],
        severity: 'medium',
        auto_escalate: false,
      },
      {
        pattern_type: 'key_person_risk',
        keywords: ['founder dependent', 'key person', 'succession plan', 'management turnover'],
        severity: 'high',
        auto_escalate: true,
      },
    ];
  }

  private getDefaultEscalationRules(): Record<string, EscalationRule> {
    return {
      critical_red_flag: {
        trigger_type: 'finding_created',
        conditions: {
          finding_type: 'red_flag',
          impact_level: 'critical',
        },
        notify_roles: ['partner', 'manager'],
        escalation_delay_hours: 0,
      },
      high_impact_finding: {
        trigger_type: 'finding_created',
        conditions: {
          impact_level: 'high',
          confidence_score_min: 0.8,
        },
        notify_roles: ['manager', 'lead'],
        escalation_delay_hours: 2,
      },
      validation_required: {
        trigger_type: 'finding_created',
        conditions: {
          confidence_score_max: 0.5,
        },
        notify_roles: ['lead', 'analyst'],
        escalation_delay_hours: 24,
      },
      phase_transition: {
        trigger_type: 'phase_completed',
        conditions: {},
        notify_roles: ['partner', 'manager'],
        escalation_delay_hours: 0,
      },
    };
  }
}
