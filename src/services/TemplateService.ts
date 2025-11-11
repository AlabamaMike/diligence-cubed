/**
 * Template Service
 * Manages structured forms and analysis templates for MBB-standard due diligence
 */

import { DatabaseClient } from '../database/client';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type TemplateCategory =
  | 'financial_analysis'
  | 'commercial_analysis'
  | 'technical_analysis'
  | 'operational_analysis'
  | 'integration_planning'
  | 'risk_assessment';

export type FieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'textarea'
  | 'table'
  | 'file_upload'
  | 'boolean'
  | 'rating'
  | 'calculated';

export interface TemplateField {
  id: string;
  label: string;
  field_type: FieldType;
  description?: string;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string; // Custom validation function name
  };
  options?: Array<{ value: string; label: string }>; // For select/multi_select
  default_value?: any;
  calculation_formula?: string; // For calculated fields
  conditional_display?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  help_text?: string;
  placeholder?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: TemplateField[];
  repeatable?: boolean; // Allow multiple instances of this section
}

export interface AnalysisTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  version: string;
  created_by: string;
  is_system_template: boolean;
  industry_tags?: string[]; // e.g., ['technology', 'saas']
  deal_type_tags?: string[]; // e.g., ['growth_equity', 'buyout']
  sections: TemplateSection[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateResponse {
  id: string;
  template_id: string;
  deal_id: string;
  workstream_id?: string;
  respondent_user_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  responses: Record<string, any>; // field_id -> value
  validation_errors?: Array<{ field_id: string; error: string }>;
  submitted_at?: Date;
  approved_by?: string;
  approved_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TableRow {
  [column: string]: any;
}

// ============================================================================
// PRE-DEFINED MBB-STANDARD TEMPLATES
// ============================================================================

const SYSTEM_TEMPLATES: Omit<AnalysisTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Quality of Earnings (QoE) Analysis',
    category: 'financial_analysis',
    description: 'Comprehensive quality of earnings assessment following MBB methodology',
    version: '1.0',
    created_by: 'system',
    is_system_template: true,
    industry_tags: ['all'],
    deal_type_tags: ['buyout', 'growth_equity'],
    sections: [
      {
        id: 'revenue_quality',
        title: 'Revenue Quality Assessment',
        description: 'Analyze revenue recognition, sustainability, and quality',
        order: 1,
        fields: [
          {
            id: 'revenue_recognition_policy',
            label: 'Revenue Recognition Policy',
            field_type: 'textarea',
            required: true,
            help_text: 'Describe the company\'s revenue recognition methodology',
          },
          {
            id: 'recurring_revenue_pct',
            label: 'Recurring Revenue %',
            field_type: 'percentage',
            required: true,
            validation: { min: 0, max: 100 },
          },
          {
            id: 'customer_concentration',
            label: 'Top 10 Customer Concentration',
            field_type: 'percentage',
            required: true,
            validation: { min: 0, max: 100 },
          },
          {
            id: 'revenue_quality_rating',
            label: 'Overall Revenue Quality Rating',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
            help_text: '1 = Poor, 5 = Excellent',
          },
        ],
      },
      {
        id: 'ebitda_adjustments',
        title: 'EBITDA Normalization',
        description: 'Identify and quantify adjustments to reported EBITDA',
        order: 2,
        fields: [
          {
            id: 'reported_ebitda',
            label: 'Reported EBITDA',
            field_type: 'currency',
            required: true,
          },
          {
            id: 'adjustment_table',
            label: 'EBITDA Adjustments',
            field_type: 'table',
            required: true,
            help_text: 'List all normalization adjustments with justification',
          },
          {
            id: 'adjusted_ebitda',
            label: 'Adjusted EBITDA',
            field_type: 'currency',
            required: true,
            calculation_formula: 'reported_ebitda + sum(adjustment_table.amount)',
          },
          {
            id: 'adjustment_quality_score',
            label: 'Adjustment Quality Score',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
            help_text: 'Quality and defensibility of adjustments',
          },
        ],
      },
      {
        id: 'working_capital',
        title: 'Working Capital Analysis',
        order: 3,
        fields: [
          {
            id: 'dso',
            label: 'Days Sales Outstanding (DSO)',
            field_type: 'number',
            required: true,
          },
          {
            id: 'dio',
            label: 'Days Inventory Outstanding (DIO)',
            field_type: 'number',
            required: true,
          },
          {
            id: 'dpo',
            label: 'Days Payable Outstanding (DPO)',
            field_type: 'number',
            required: true,
          },
          {
            id: 'normalized_nwc',
            label: 'Normalized Net Working Capital',
            field_type: 'currency',
            required: true,
          },
        ],
      },
    ],
    metadata: {
      estimated_time_minutes: 120,
      required_documents: ['Financial statements', 'GL detail', 'AR/AP aging'],
    },
  },
  {
    name: 'Market Sizing & TAM Analysis',
    category: 'commercial_analysis',
    description: 'Total Addressable Market analysis with TAM/SAM/SOM breakdown',
    version: '1.0',
    created_by: 'system',
    is_system_template: true,
    industry_tags: ['all'],
    sections: [
      {
        id: 'market_definition',
        title: 'Market Definition',
        order: 1,
        fields: [
          {
            id: 'market_description',
            label: 'Market Description',
            field_type: 'textarea',
            required: true,
            help_text: 'Define the total addressable market',
          },
          {
            id: 'geographic_scope',
            label: 'Geographic Scope',
            field_type: 'multi_select',
            required: true,
            options: [
              { value: 'north_america', label: 'North America' },
              { value: 'europe', label: 'Europe' },
              { value: 'asia_pacific', label: 'Asia Pacific' },
              { value: 'latam', label: 'Latin America' },
              { value: 'global', label: 'Global' },
            ],
          },
        ],
      },
      {
        id: 'tam_sam_som',
        title: 'TAM/SAM/SOM Sizing',
        order: 2,
        fields: [
          {
            id: 'tam_value',
            label: 'Total Addressable Market (TAM)',
            field_type: 'currency',
            required: true,
          },
          {
            id: 'tam_methodology',
            label: 'TAM Methodology',
            field_type: 'select',
            required: true,
            options: [
              { value: 'top_down', label: 'Top-down (market reports)' },
              { value: 'bottom_up', label: 'Bottom-up (customer data)' },
              { value: 'value_theory', label: 'Value theory' },
            ],
          },
          {
            id: 'sam_value',
            label: 'Serviceable Addressable Market (SAM)',
            field_type: 'currency',
            required: true,
          },
          {
            id: 'som_value',
            label: 'Serviceable Obtainable Market (SOM)',
            field_type: 'currency',
            required: true,
          },
          {
            id: 'market_growth_rate',
            label: 'Market Growth Rate (CAGR)',
            field_type: 'percentage',
            required: true,
            validation: { min: -50, max: 100 },
          },
        ],
      },
      {
        id: 'competitive_landscape',
        title: 'Competitive Landscape',
        order: 3,
        fields: [
          {
            id: 'competitor_table',
            label: 'Key Competitors',
            field_type: 'table',
            required: true,
            help_text: 'List top 5-10 competitors with market share',
          },
          {
            id: 'hhi_index',
            label: 'HHI (Herfindahl-Hirschman Index)',
            field_type: 'number',
            required: false,
            validation: { min: 0, max: 10000 },
          },
        ],
      },
    ],
    metadata: {
      estimated_time_minutes: 90,
      required_documents: ['Market research reports', 'Competitive analysis', 'Customer data'],
    },
  },
  {
    name: 'Technical Architecture Assessment',
    category: 'technical_analysis',
    description: 'Comprehensive technical stack and architecture evaluation',
    version: '1.0',
    created_by: 'system',
    is_system_template: true,
    industry_tags: ['technology', 'saas'],
    sections: [
      {
        id: 'tech_stack',
        title: 'Technology Stack',
        order: 1,
        fields: [
          {
            id: 'frontend_technologies',
            label: 'Frontend Technologies',
            field_type: 'multi_select',
            required: true,
            options: [
              { value: 'react', label: 'React' },
              { value: 'vue', label: 'Vue.js' },
              { value: 'angular', label: 'Angular' },
              { value: 'other', label: 'Other' },
            ],
          },
          {
            id: 'backend_technologies',
            label: 'Backend Technologies',
            field_type: 'multi_select',
            required: true,
            options: [
              { value: 'nodejs', label: 'Node.js' },
              { value: 'python', label: 'Python' },
              { value: 'java', label: 'Java' },
              { value: 'dotnet', label: '.NET' },
              { value: 'other', label: 'Other' },
            ],
          },
          {
            id: 'database_systems',
            label: 'Database Systems',
            field_type: 'multi_select',
            required: true,
            options: [
              { value: 'postgresql', label: 'PostgreSQL' },
              { value: 'mysql', label: 'MySQL' },
              { value: 'mongodb', label: 'MongoDB' },
              { value: 'redis', label: 'Redis' },
              { value: 'other', label: 'Other' },
            ],
          },
        ],
      },
      {
        id: 'scalability',
        title: 'Scalability Assessment',
        order: 2,
        fields: [
          {
            id: 'horizontal_scalability',
            label: 'Horizontal Scalability',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
            help_text: 'Ability to add more servers/instances',
          },
          {
            id: 'vertical_scalability',
            label: 'Vertical Scalability',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
            help_text: 'Ability to upgrade server resources',
          },
          {
            id: 'max_concurrent_users',
            label: 'Max Concurrent Users (tested)',
            field_type: 'number',
            required: false,
          },
        ],
      },
      {
        id: 'security_compliance',
        title: 'Security & Compliance',
        order: 3,
        fields: [
          {
            id: 'certifications',
            label: 'Security Certifications',
            field_type: 'multi_select',
            required: false,
            options: [
              { value: 'soc2', label: 'SOC 2' },
              { value: 'iso27001', label: 'ISO 27001' },
              { value: 'hipaa', label: 'HIPAA' },
              { value: 'gdpr', label: 'GDPR Compliant' },
              { value: 'pci', label: 'PCI DSS' },
            ],
          },
          {
            id: 'security_score',
            label: 'Overall Security Score',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
          },
        ],
      },
    ],
    metadata: {
      estimated_time_minutes: 150,
      required_documents: ['Architecture diagrams', 'Tech stack documentation', 'Security audit reports'],
    },
  },
  {
    name: 'Day-1 Integration Readiness',
    category: 'integration_planning',
    description: 'Assessment of organizational readiness for post-acquisition integration',
    version: '1.0',
    created_by: 'system',
    is_system_template: true,
    industry_tags: ['all'],
    deal_type_tags: ['buyout'],
    sections: [
      {
        id: 'leadership_readiness',
        title: 'Leadership & Governance',
        order: 1,
        fields: [
          {
            id: 'management_retention',
            label: 'Key Management Retention Rate',
            field_type: 'percentage',
            required: true,
            validation: { min: 0, max: 100 },
          },
          {
            id: 'integration_lead_identified',
            label: 'Integration Lead Identified',
            field_type: 'boolean',
            required: true,
          },
          {
            id: 'governance_structure',
            label: 'Post-Close Governance Structure',
            field_type: 'textarea',
            required: true,
          },
        ],
      },
      {
        id: 'systems_integration',
        title: 'Systems & IT Integration',
        order: 2,
        fields: [
          {
            id: 'erp_compatibility',
            label: 'ERP System Compatibility',
            field_type: 'select',
            required: true,
            options: [
              { value: 'compatible', label: 'Compatible - minimal effort' },
              { value: 'moderate', label: 'Moderate integration required' },
              { value: 'incompatible', label: 'Incompatible - full migration needed' },
            ],
          },
          {
            id: 'data_migration_complexity',
            label: 'Data Migration Complexity',
            field_type: 'rating',
            required: true,
            validation: { min: 1, max: 5 },
            help_text: '1 = Simple, 5 = Highly Complex',
          },
          {
            id: 'estimated_integration_days',
            label: 'Estimated Integration Timeline (days)',
            field_type: 'number',
            required: true,
            validation: { min: 1, max: 730 },
          },
        ],
      },
      {
        id: 'synergies',
        title: 'Synergy Identification',
        order: 3,
        repeatable: true,
        fields: [
          {
            id: 'synergy_table',
            label: 'Identified Synergies',
            field_type: 'table',
            required: true,
            help_text: 'List synergies with timeline, amount, and probability',
          },
          {
            id: 'total_synergy_value',
            label: 'Total Synergy Value (NPV)',
            field_type: 'currency',
            required: true,
          },
        ],
      },
    ],
    metadata: {
      estimated_time_minutes: 180,
      required_documents: ['Org charts', 'IT inventory', 'Integration plan draft'],
    },
  },
];

// ============================================================================
// TEMPLATE SERVICE
// ============================================================================

export class TemplateService {
  constructor(private db: DatabaseClient) {
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for templates
   */
  private async initializeDatabase(): Promise<void> {
    // Create analysis_templates table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS analysis_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        version VARCHAR(20) NOT NULL DEFAULT '1.0',
        created_by VARCHAR(100) NOT NULL,
        is_system_template BOOLEAN DEFAULT false,
        industry_tags JSONB,
        deal_type_tags JSONB,
        sections JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_templates_category (category),
        INDEX idx_templates_system (is_system_template)
      );
    `);

    // Create template_responses table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS template_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES analysis_templates(id) ON DELETE CASCADE,
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        workstream_id UUID REFERENCES workstreams(id) ON DELETE SET NULL,
        respondent_user_id VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        responses JSONB NOT NULL DEFAULT '{}',
        validation_errors JSONB,
        submitted_at TIMESTAMPTZ,
        approved_by VARCHAR(100),
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_template_responses_deal (deal_id),
        INDEX idx_template_responses_template (template_id),
        INDEX idx_template_responses_status (status)
      );
    `);

    logger.info('Template database initialized');
  }

  /**
   * Seed system templates into database
   */
  async seedSystemTemplates(): Promise<void> {
    logger.info('Seeding system templates');

    for (const template of SYSTEM_TEMPLATES) {
      // Check if template already exists
      const existing = await this.db.query(
        'SELECT id FROM analysis_templates WHERE name = $1 AND is_system_template = true',
        [template.name]
      );

      if (existing.rows.length === 0) {
        await this.db.query(
          `INSERT INTO analysis_templates
           (name, category, description, version, created_by, is_system_template,
            industry_tags, deal_type_tags, sections, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            template.name,
            template.category,
            template.description,
            template.version,
            template.created_by,
            template.is_system_template,
            JSON.stringify(template.industry_tags || []),
            JSON.stringify(template.deal_type_tags || []),
            JSON.stringify(template.sections),
            JSON.stringify(template.metadata || {}),
          ]
        );
        logger.info('Seeded system template', { name: template.name });
      }
    }
  }

  // ==========================================================================
  // TEMPLATE MANAGEMENT
  // ==========================================================================

  /**
   * Create custom template
   */
  async createTemplate(
    template: Omit<AnalysisTemplate, 'id' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    logger.info('Creating custom template', { name: template.name });

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO analysis_templates
       (name, category, description, version, created_by, is_system_template,
        industry_tags, deal_type_tags, sections, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        template.name,
        template.category,
        template.description,
        template.version,
        template.created_by,
        template.is_system_template,
        JSON.stringify(template.industry_tags || []),
        JSON.stringify(template.deal_type_tags || []),
        JSON.stringify(template.sections),
        JSON.stringify(template.metadata || {}),
      ]
    );

    logger.info('Template created', { templateId: result.rows[0].id });
    return result.rows[0].id;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<AnalysisTemplate | null> {
    const result = await this.db.query<AnalysisTemplate>(
      'SELECT * FROM analysis_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserializeTemplate(result.rows[0]);
  }

  /**
   * List templates with optional filtering
   */
  async listTemplates(filters?: {
    category?: TemplateCategory;
    industry_tag?: string;
    deal_type_tag?: string;
    system_only?: boolean;
  }): Promise<AnalysisTemplate[]> {
    let query = 'SELECT * FROM analysis_templates WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters?.industry_tag) {
      query += ` AND industry_tags @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([filters.industry_tag]));
    }

    if (filters?.deal_type_tag) {
      query += ` AND deal_type_tags @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([filters.deal_type_tag]));
    }

    if (filters?.system_only !== undefined) {
      query += ` AND is_system_template = $${paramIndex++}`;
      params.push(filters.system_only);
    }

    query += ' ORDER BY is_system_template DESC, name ASC';

    const result = await this.db.query<AnalysisTemplate>(query, params);

    return result.rows.map((row) => this.deserializeTemplate(row));
  }

  /**
   * Update template (only custom templates can be updated)
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<AnalysisTemplate, 'id' | 'created_at' | 'updated_at' | 'is_system_template'>>
  ): Promise<void> {
    logger.info('Updating template', { templateId });

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.sections) {
      setClauses.push(`sections = $${paramIndex++}`);
      params.push(JSON.stringify(updates.sections));
    }
    if (updates.metadata) {
      setClauses.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updates.metadata));
    }

    setClauses.push(`updated_at = NOW()`);

    params.push(templateId);

    await this.db.query(
      `UPDATE analysis_templates
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND is_system_template = false`,
      params
    );

    logger.info('Template updated', { templateId });
  }

  // ==========================================================================
  // TEMPLATE RESPONSES
  // ==========================================================================

  /**
   * Create new template response
   */
  async createResponse(
    templateId: string,
    dealId: string,
    userId: string,
    workstreamId?: string
  ): Promise<string> {
    logger.info('Creating template response', { templateId, dealId });

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO template_responses
       (template_id, deal_id, workstream_id, respondent_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [templateId, dealId, workstreamId || null, userId]
    );

    logger.info('Response created', { responseId: result.rows[0].id });
    return result.rows[0].id;
  }

  /**
   * Update response fields
   */
  async updateResponse(
    responseId: string,
    fieldId: string,
    value: any
  ): Promise<void> {
    logger.info('Updating response field', { responseId, fieldId });

    // Get current responses
    const current = await this.db.query<{ responses: any }>(
      'SELECT responses FROM template_responses WHERE id = $1',
      [responseId]
    );

    if (current.rows.length === 0) {
      throw new Error(`Response not found: ${responseId}`);
    }

    const responses = typeof current.rows[0].responses === 'string'
      ? JSON.parse(current.rows[0].responses)
      : current.rows[0].responses;

    responses[fieldId] = value;

    await this.db.query(
      `UPDATE template_responses
       SET responses = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(responses), responseId]
    );
  }

  /**
   * Validate and submit response
   */
  async submitResponse(responseId: string): Promise<{
    valid: boolean;
    errors: Array<{ field_id: string; error: string }>;
  }> {
    logger.info('Submitting response', { responseId });

    // Get response and template
    const responseResult = await this.db.query<TemplateResponse>(
      'SELECT * FROM template_responses WHERE id = $1',
      [responseId]
    );

    if (responseResult.rows.length === 0) {
      throw new Error(`Response not found: ${responseId}`);
    }

    const response = responseResult.rows[0];
    const template = await this.getTemplate(response.template_id);

    if (!template) {
      throw new Error(`Template not found: ${response.template_id}`);
    }

    // Validate responses
    const errors = this.validateResponses(
      template,
      typeof response.responses === 'string'
        ? JSON.parse(response.responses)
        : response.responses
    );

    if (errors.length === 0) {
      // Mark as submitted
      await this.db.query(
        `UPDATE template_responses
         SET status = 'submitted', submitted_at = NOW(), validation_errors = NULL
         WHERE id = $1`,
        [responseId]
      );
      return { valid: true, errors: [] };
    } else {
      // Store validation errors
      await this.db.query(
        `UPDATE template_responses
         SET validation_errors = $1
         WHERE id = $2`,
        [JSON.stringify(errors), responseId]
      );
      return { valid: false, errors };
    }
  }

  /**
   * Approve response
   */
  async approveResponse(responseId: string, approverUserId: string): Promise<void> {
    logger.info('Approving response', { responseId, approverUserId });

    await this.db.query(
      `UPDATE template_responses
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'submitted'`,
      [approverUserId, responseId]
    );
  }

  /**
   * Reject response with reason
   */
  async rejectResponse(responseId: string, reason: string): Promise<void> {
    logger.info('Rejecting response', { responseId });

    await this.db.query(
      `UPDATE template_responses
       SET status = 'rejected', rejection_reason = $1
       WHERE id = $2 AND status = 'submitted'`,
      [reason, responseId]
    );
  }

  /**
   * Get response by ID
   */
  async getResponse(responseId: string): Promise<TemplateResponse | null> {
    const result = await this.db.query<TemplateResponse>(
      'SELECT * FROM template_responses WHERE id = $1',
      [responseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses,
      validation_errors: row.validation_errors && typeof row.validation_errors === 'string'
        ? JSON.parse(row.validation_errors)
        : row.validation_errors,
    };
  }

  /**
   * List responses for a deal
   */
  async listResponsesForDeal(dealId: string): Promise<TemplateResponse[]> {
    const result = await this.db.query<TemplateResponse>(
      'SELECT * FROM template_responses WHERE deal_id = $1 ORDER BY created_at DESC',
      [dealId]
    );

    return result.rows.map((row) => ({
      ...row,
      responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses,
      validation_errors: row.validation_errors && typeof row.validation_errors === 'string'
        ? JSON.parse(row.validation_errors)
        : row.validation_errors,
    }));
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private deserializeTemplate(row: any): AnalysisTemplate {
    return {
      ...row,
      industry_tags: typeof row.industry_tags === 'string'
        ? JSON.parse(row.industry_tags)
        : row.industry_tags,
      deal_type_tags: typeof row.deal_type_tags === 'string'
        ? JSON.parse(row.deal_type_tags)
        : row.deal_type_tags,
      sections: typeof row.sections === 'string'
        ? JSON.parse(row.sections)
        : row.sections,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    };
  }

  private validateResponses(
    template: AnalysisTemplate,
    responses: Record<string, any>
  ): Array<{ field_id: string; error: string }> {
    const errors: Array<{ field_id: string; error: string }> = [];

    for (const section of template.sections) {
      for (const field of section.fields) {
        const value = responses[field.id];

        // Check required fields
        if (field.required && (value === undefined || value === null || value === '')) {
          errors.push({
            field_id: field.id,
            error: `${field.label} is required`,
          });
          continue;
        }

        if (value === undefined || value === null) {
          continue;
        }

        // Type-specific validation
        if (field.validation) {
          if (field.validation.min !== undefined && typeof value === 'number' && value < field.validation.min) {
            errors.push({
              field_id: field.id,
              error: `${field.label} must be at least ${field.validation.min}`,
            });
          }

          if (field.validation.max !== undefined && typeof value === 'number' && value > field.validation.max) {
            errors.push({
              field_id: field.id,
              error: `${field.label} must be at most ${field.validation.max}`,
            });
          }

          if (field.validation.pattern && typeof value === 'string') {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
              errors.push({
                field_id: field.id,
                error: `${field.label} format is invalid`,
              });
            }
          }
        }
      }
    }

    return errors;
  }
}
