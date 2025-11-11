/**
 * Finding Repository
 * Data access layer for findings with confidence scoring and citation chains
 */

import { DatabaseClient } from '../client';
import {
  Finding,
  Citation,
  InterAgentReference,
  FindingType,
  ValidationStatus,
  ImpactLevel,
  ReferenceType,
  HighPriorityFinding,
} from '../../types/database';
import { logger } from '../../utils/logger';

export interface CreateFindingInput {
  deal_id: string;
  workstream_id?: string;
  title: string;
  description: string;
  finding_type: FindingType;
  category?: string;
  confidence_score: number;
  impact_level?: ImpactLevel;
  financial_impact_usd?: number;
  generated_by_agent: string;
  agent_reasoning?: string;
}

export interface UpdateFindingInput {
  title?: string;
  description?: string;
  validation_status?: ValidationStatus;
  impact_level?: ImpactLevel;
  financial_impact_usd?: number;
  reviewed_by?: string;
  reviewed_at?: Date;
  reviewer_notes?: string;
}

export interface CreateCitationInput {
  finding_id: string;
  document_id: string;
  page_number?: number;
  excerpt?: string;
  context?: string;
  relevance_score?: number;
}

export interface FindingSearchOptions {
  finding_type?: FindingType;
  validation_status?: ValidationStatus;
  impact_level?: ImpactLevel;
  min_confidence?: number;
  workstream_id?: string;
  limit?: number;
  offset?: number;
}

export class FindingRepository {
  constructor(private db: DatabaseClient) {}

  // ============================================================================
  // FINDINGS
  // ============================================================================

  /**
   * Create a new finding
   */
  async create(input: CreateFindingInput): Promise<Finding> {
    const query = `
      INSERT INTO findings (
        deal_id, workstream_id, title, description, finding_type,
        category, confidence_score, impact_level, financial_impact_usd,
        generated_by_agent, agent_reasoning
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      input.deal_id,
      input.workstream_id,
      input.title,
      input.description,
      input.finding_type,
      input.category,
      input.confidence_score,
      input.impact_level,
      input.financial_impact_usd,
      input.generated_by_agent,
      input.agent_reasoning,
    ];

    const result = await this.db.query<Finding>(query, values);
    logger.info('Finding created', {
      findingId: result.rows[0].id,
      dealId: input.deal_id,
      type: input.finding_type,
      confidence: input.confidence_score,
    });
    return result.rows[0];
  }

  /**
   * Get finding by ID
   */
  async findById(findingId: string): Promise<Finding | null> {
    const query = 'SELECT * FROM findings WHERE id = $1';
    const result = await this.db.query<Finding>(query, [findingId]);
    return result.rows[0] || null;
  }

  /**
   * Get findings by deal
   */
  async findByDeal(dealId: string, options: FindingSearchOptions = {}): Promise<Finding[]> {
    let query = 'SELECT * FROM findings WHERE deal_id = $1';
    const params: any[] = [dealId];
    let paramCount = 2;

    if (options.finding_type) {
      query += ` AND finding_type = $${paramCount}`;
      params.push(options.finding_type);
      paramCount++;
    }

    if (options.validation_status) {
      query += ` AND validation_status = $${paramCount}`;
      params.push(options.validation_status);
      paramCount++;
    }

    if (options.impact_level) {
      query += ` AND impact_level = $${paramCount}`;
      params.push(options.impact_level);
      paramCount++;
    }

    if (options.min_confidence !== undefined) {
      query += ` AND confidence_score >= $${paramCount}`;
      params.push(options.min_confidence);
      paramCount++;
    }

    if (options.workstream_id) {
      query += ` AND workstream_id = $${paramCount}`;
      params.push(options.workstream_id);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(options.limit || 100, options.offset || 0);

    const result = await this.db.query<Finding>(query, params);
    return result.rows;
  }

  /**
   * Get findings by workstream
   */
  async findByWorkstream(
    workstreamId: string,
    limit = 100,
    offset = 0
  ): Promise<Finding[]> {
    const query = `
      SELECT * FROM findings
      WHERE workstream_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<Finding>(query, [workstreamId, limit, offset]);
    return result.rows;
  }

  /**
   * Get red flags for a deal
   */
  async getRedFlags(dealId: string): Promise<Finding[]> {
    const query = `
      SELECT * FROM findings
      WHERE deal_id = $1 AND finding_type = 'red_flag'
      ORDER BY
        CASE impact_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
    `;

    const result = await this.db.query<Finding>(query, [dealId]);
    return result.rows;
  }

  /**
   * Get high priority findings
   */
  async getHighPriority(dealId: string, limit = 50): Promise<HighPriorityFinding[]> {
    const query = `
      SELECT * FROM high_priority_findings
      WHERE id IN (SELECT id FROM findings WHERE deal_id = $1)
      ORDER BY
        CASE impact_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        confidence_score DESC
      LIMIT $2
    `;

    const result = await this.db.query<HighPriorityFinding>(query, [dealId, limit]);
    return result.rows;
  }

  /**
   * Update finding
   */
  async update(findingId: string, input: UpdateFindingInput): Promise<Finding | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(findingId);
    }

    values.push(findingId);
    const query = `
      UPDATE findings
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query<Finding>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Accept finding
   */
  async accept(findingId: string, reviewedBy: string, notes?: string): Promise<Finding | null> {
    const query = `
      UPDATE findings
      SET validation_status = 'accepted',
          reviewed_by = $2,
          reviewed_at = NOW(),
          reviewer_notes = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<Finding>(query, [findingId, reviewedBy, notes]);
    logger.info('Finding accepted', { findingId, reviewedBy });
    return result.rows[0] || null;
  }

  /**
   * Reject finding
   */
  async reject(findingId: string, reviewedBy: string, notes: string): Promise<Finding | null> {
    const query = `
      UPDATE findings
      SET validation_status = 'rejected',
          reviewed_by = $2,
          reviewed_at = NOW(),
          reviewer_notes = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<Finding>(query, [findingId, reviewedBy, notes]);
    logger.info('Finding rejected', { findingId, reviewedBy });
    return result.rows[0] || null;
  }

  /**
   * Get finding statistics for a deal
   */
  async getStatistics(dealId: string) {
    const query = `
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN finding_type = 'red_flag' THEN 1 END) as red_flag_count,
        COUNT(CASE WHEN validation_status = 'accepted' THEN 1 END) as accepted_count,
        COUNT(CASE WHEN validation_status = 'pending' THEN 1 END) as pending_count,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN impact_level = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN impact_level = 'high' THEN 1 END) as high_count
      FROM findings
      WHERE deal_id = $1
    `;

    const result = await this.db.query<{
      total_count: string;
      red_flag_count: string;
      accepted_count: string;
      pending_count: string;
      avg_confidence: string;
      critical_count: string;
      high_count: string;
    }>(query, [dealId]);

    return {
      totalCount: parseInt(result.rows[0]?.total_count || '0'),
      redFlagCount: parseInt(result.rows[0]?.red_flag_count || '0'),
      acceptedCount: parseInt(result.rows[0]?.accepted_count || '0'),
      pendingCount: parseInt(result.rows[0]?.pending_count || '0'),
      avgConfidence: parseFloat(result.rows[0]?.avg_confidence || '0'),
      criticalCount: parseInt(result.rows[0]?.critical_count || '0'),
      highCount: parseInt(result.rows[0]?.high_count || '0'),
    };
  }

  // ============================================================================
  // CITATIONS
  // ============================================================================

  /**
   * Create citation
   */
  async createCitation(input: CreateCitationInput): Promise<Citation> {
    const query = `
      INSERT INTO citations (
        finding_id, document_id, page_number, excerpt, context, relevance_score
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      input.finding_id,
      input.document_id,
      input.page_number,
      input.excerpt,
      input.context,
      input.relevance_score,
    ];

    const result = await this.db.query<Citation>(query, values);
    logger.debug('Citation created', {
      citationId: result.rows[0].id,
      findingId: input.finding_id,
    });
    return result.rows[0];
  }

  /**
   * Get citations for a finding
   */
  async getCitations(findingId: string): Promise<Citation[]> {
    const query = `
      SELECT c.*, d.filename, d.document_type
      FROM citations c
      JOIN documents d ON d.id = c.document_id
      WHERE c.finding_id = $1
      ORDER BY c.relevance_score DESC NULLS LAST, c.created_at ASC
    `;

    const result = await this.db.query<
      Citation & { filename: string; document_type?: string }
    >(query, [findingId]);
    return result.rows;
  }

  /**
   * Get finding with citations
   */
  async getWithCitations(findingId: string): Promise<{
    finding: Finding;
    citations: Citation[];
  } | null> {
    const finding = await this.findById(findingId);
    if (!finding) return null;

    const citations = await this.getCitations(findingId);
    return { finding, citations };
  }

  /**
   * Delete citation
   */
  async deleteCitation(citationId: string): Promise<boolean> {
    const query = 'DELETE FROM citations WHERE id = $1';
    const result = await this.db.query(query, [citationId]);
    return (result.rowCount || 0) > 0;
  }

  // ============================================================================
  // INTER-AGENT REFERENCES
  // ============================================================================

  /**
   * Create inter-agent reference
   */
  async createReference(
    sourceFindingId: string,
    referencedFindingId: string,
    referenceType: ReferenceType
  ): Promise<InterAgentReference> {
    const query = `
      INSERT INTO inter_agent_references (
        source_finding_id, referenced_finding_id, reference_type
      )
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await this.db.query<InterAgentReference>(query, [
      sourceFindingId,
      referencedFindingId,
      referenceType,
    ]);
    return result.rows[0];
  }

  /**
   * Get references from a finding
   */
  async getReferencesFrom(findingId: string): Promise<InterAgentReference[]> {
    const query = `
      SELECT r.*, f.title as referenced_title
      FROM inter_agent_references r
      JOIN findings f ON f.id = r.referenced_finding_id
      WHERE r.source_finding_id = $1
    `;

    const result = await this.db.query<
      InterAgentReference & { referenced_title: string }
    >(query, [findingId]);
    return result.rows;
  }

  /**
   * Get references to a finding
   */
  async getReferencesTo(findingId: string): Promise<InterAgentReference[]> {
    const query = `
      SELECT r.*, f.title as source_title
      FROM inter_agent_references r
      JOIN findings f ON f.id = r.source_finding_id
      WHERE r.referenced_finding_id = $1
    `;

    const result = await this.db.query<InterAgentReference & { source_title: string }>(
      query,
      [findingId]
    );
    return result.rows;
  }

  /**
   * Get related findings (bidirectional)
   */
  async getRelatedFindings(findingId: string): Promise<Finding[]> {
    const query = `
      SELECT DISTINCT f.*
      FROM findings f
      WHERE f.id IN (
        SELECT referenced_finding_id FROM inter_agent_references
        WHERE source_finding_id = $1
        UNION
        SELECT source_finding_id FROM inter_agent_references
        WHERE referenced_finding_id = $1
      )
    `;

    const result = await this.db.query<Finding>(query, [findingId]);
    return result.rows;
  }
}
