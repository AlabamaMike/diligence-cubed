/**
 * Deal Repository
 * Data access layer for deals with multi-tenant isolation
 */

import { DatabaseClient } from '../client';
import { Deal, DealType, DealStatus, DealPhase, DealSummary } from '../../types/database';
import { logger } from '../../utils/logger';

export interface CreateDealInput {
  name: string;
  target_company: string;
  deal_type: DealType;
  deal_size_usd?: number;
  target_industry?: string;
  target_region?: string;
  encryption_key_id: string;
  created_by: string;
  target_close_date?: Date;
}

export interface UpdateDealInput {
  name?: string;
  status?: DealStatus;
  current_phase?: DealPhase;
  deal_size_usd?: number;
  target_industry?: string;
  target_region?: string;
  target_close_date?: Date;
}

export class DealRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Create a new deal
   */
  async create(input: CreateDealInput): Promise<Deal> {
    const query = `
      INSERT INTO deals (
        name, target_company, deal_type, deal_size_usd,
        target_industry, target_region, encryption_key_id,
        created_by, target_close_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      input.name,
      input.target_company,
      input.deal_type,
      input.deal_size_usd,
      input.target_industry,
      input.target_region,
      input.encryption_key_id,
      input.created_by,
      input.target_close_date,
    ];

    const result = await this.db.query<Deal>(query, values);
    logger.info('Deal created', { dealId: result.rows[0].id, name: input.name });
    return result.rows[0];
  }

  /**
   * Get deal by ID
   */
  async findById(dealId: string): Promise<Deal | null> {
    const query = 'SELECT * FROM deals WHERE id = $1';
    const result = await this.db.query<Deal>(query, [dealId]);
    return result.rows[0] || null;
  }

  /**
   * Get deal by ID with access check
   */
  async findByIdWithAccess(dealId: string, userId: string): Promise<Deal | null> {
    const query = `
      SELECT d.*
      FROM deals d
      INNER JOIN deal_access da ON da.deal_id = d.id
      WHERE d.id = $1 AND da.user_id = $2
    `;
    const result = await this.db.query<Deal>(query, [dealId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Update deal
   */
  async update(dealId: string, input: UpdateDealInput): Promise<Deal | null> {
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
      return this.findById(dealId);
    }

    values.push(dealId);
    const query = `
      UPDATE deals
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query<Deal>(query, values);
    logger.info('Deal updated', { dealId, fields: Object.keys(input) });
    return result.rows[0] || null;
  }

  /**
   * Update deal phase
   */
  async updatePhase(dealId: string, newPhase: DealPhase): Promise<Deal | null> {
    const query = `
      UPDATE deals
      SET current_phase = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query<Deal>(query, [newPhase, dealId]);
    logger.info('Deal phase updated', { dealId, newPhase });
    return result.rows[0] || null;
  }

  /**
   * Get deals by status
   */
  async findByStatus(status: DealStatus, limit = 100, offset = 0): Promise<Deal[]> {
    const query = `
      SELECT * FROM deals
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<Deal>(query, [status, limit, offset]);
    return result.rows;
  }

  /**
   * Get deals accessible by user
   */
  async findByUser(userId: string, limit = 100, offset = 0): Promise<Deal[]> {
    const query = `
      SELECT d.*
      FROM deals d
      INNER JOIN deal_access da ON da.deal_id = d.id
      WHERE da.user_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<Deal>(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Get deal summary with statistics
   */
  async getSummary(dealId: string): Promise<DealSummary | null> {
    const query = 'SELECT * FROM deal_summary WHERE id = $1';
    const result = await this.db.query<DealSummary>(query, [dealId]);
    return result.rows[0] || null;
  }

  /**
   * Get all deal summaries for a user
   */
  async getUserDealSummaries(userId: string, limit = 100, offset = 0): Promise<DealSummary[]> {
    const query = `
      SELECT ds.*
      FROM deal_summary ds
      INNER JOIN deal_access da ON da.deal_id = ds.id
      WHERE da.user_id = $1
      ORDER BY ds.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<DealSummary>(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Archive deal
   */
  async archive(dealId: string): Promise<Deal | null> {
    return this.update(dealId, { status: 'archived' });
  }

  /**
   * Delete deal (soft delete by archiving)
   */
  async delete(dealId: string): Promise<boolean> {
    const deal = await this.archive(dealId);
    return deal !== null;
  }

  /**
   * Hard delete deal (use with caution)
   */
  async hardDelete(dealId: string): Promise<boolean> {
    const query = 'DELETE FROM deals WHERE id = $1';
    const result = await this.db.query(query, [dealId]);
    logger.warn('Deal hard deleted', { dealId });
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if deal exists
   */
  async exists(dealId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM deals WHERE id = $1';
    const result = await this.db.query(query, [dealId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get deal count by status
   */
  async countByStatus(status: DealStatus): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM deals WHERE status = $1';
    const result = await this.db.query<{ count: string }>(query, [status]);
    return parseInt(result.rows[0]?.count || '0');
  }

  /**
   * Search deals by name or target company
   */
  async search(searchTerm: string, userId?: string, limit = 50): Promise<Deal[]> {
    let query = `
      SELECT DISTINCT d.*
      FROM deals d
    `;

    const params: any[] = [`%${searchTerm}%`, `%${searchTerm}%`];
    let paramIndex = 3;

    if (userId) {
      query += `
        INNER JOIN deal_access da ON da.deal_id = d.id
        WHERE (d.name ILIKE $1 OR d.target_company ILIKE $2)
        AND da.user_id = $${paramIndex}
      `;
      params.push(userId);
      paramIndex++;
    } else {
      query += `
        WHERE d.name ILIKE $1 OR d.target_company ILIKE $2
      `;
    }

    query += `
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query<Deal>(query, params);
    return result.rows;
  }
}
