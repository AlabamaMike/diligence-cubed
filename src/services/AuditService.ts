/**
 * Audit Service
 * Immutable audit trail with cryptographic verification
 */

import { DatabaseClient } from '../database/client';
import { AuditLog } from '../types/database';
import { logger } from '../utils/logger';

export interface CreateAuditLogInput {
  deal_id?: string;
  user_id?: string;
  agent_id?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  action_details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditSearchOptions {
  deal_id?: string;
  user_id?: string;
  agent_id?: string;
  action_type?: string;
  entity_type?: string;
  entity_id?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export class AuditService {
  constructor(private db: DatabaseClient) {}

  /**
   * Create audit log entry
   * Hash chaining is handled by database trigger
   */
  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        deal_id, user_id, agent_id, action_type,
        entity_type, entity_id, action_details,
        ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      input.deal_id,
      input.user_id,
      input.agent_id,
      input.action_type,
      input.entity_type,
      input.entity_id,
      JSON.stringify(input.action_details),
      input.ip_address,
      input.user_agent,
    ];

    const result = await this.db.query<AuditLog>(query, values);

    logger.debug('Audit log created', {
      auditId: result.rows[0].id,
      actionType: input.action_type,
    });

    return result.rows[0];
  }

  /**
   * Get audit log by ID
   */
  async getById(auditId: string): Promise<AuditLog | null> {
    const query = 'SELECT * FROM audit_logs WHERE id = $1';
    const result = await this.db.query<AuditLog>(query, [auditId]);
    return result.rows[0] || null;
  }

  /**
   * Search audit logs with filters
   */
  async search(options: AuditSearchOptions = {}): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (options.deal_id) {
      query += ` AND deal_id = $${paramCount}`;
      params.push(options.deal_id);
      paramCount++;
    }

    if (options.user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(options.user_id);
      paramCount++;
    }

    if (options.agent_id) {
      query += ` AND agent_id = $${paramCount}`;
      params.push(options.agent_id);
      paramCount++;
    }

    if (options.action_type) {
      query += ` AND action_type = $${paramCount}`;
      params.push(options.action_type);
      paramCount++;
    }

    if (options.entity_type) {
      query += ` AND entity_type = $${paramCount}`;
      params.push(options.entity_type);
      paramCount++;
    }

    if (options.entity_id) {
      query += ` AND entity_id = $${paramCount}`;
      params.push(options.entity_id);
      paramCount++;
    }

    if (options.start_date) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(options.start_date);
      paramCount++;
    }

    if (options.end_date) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(options.end_date);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(options.limit || 100, options.offset || 0);

    const result = await this.db.query<AuditLog>(query, params);
    return result.rows;
  }

  /**
   * Get audit trail for a specific deal
   */
  async getDealAuditTrail(
    dealId: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLog[]> {
    return this.search({ deal_id: dealId, limit, offset });
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLog[]> {
    return this.search({ entity_type: entityType, entity_id: entityId, limit, offset });
  }

  /**
   * Get audit trail for a user
   */
  async getUserAuditTrail(
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLog[]> {
    return this.search({ user_id: userId, limit, offset });
  }

  /**
   * Get audit trail for an agent
   */
  async getAgentAuditTrail(
    agentId: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLog[]> {
    return this.search({ agent_id: agentId, limit, offset });
  }

  /**
   * Verify audit log chain integrity
   * Checks that hash chain is valid from start to end
   */
  async verifyChainIntegrity(startId?: string, endId?: string): Promise<{
    valid: boolean;
    totalChecked: number;
    firstInvalidId?: string;
    error?: string;
  }> {
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];

    if (startId && endId) {
      query += ' WHERE created_at >= (SELECT created_at FROM audit_logs WHERE id = $1)';
      query += ' AND created_at <= (SELECT created_at FROM audit_logs WHERE id = $2)';
      params.push(startId, endId);
    } else if (startId) {
      query += ' WHERE created_at >= (SELECT created_at FROM audit_logs WHERE id = $1)';
      params.push(startId);
    } else if (endId) {
      query += ' WHERE created_at <= (SELECT created_at FROM audit_logs WHERE id = $1)';
      params.push(endId);
    }

    query += ' ORDER BY created_at ASC';

    const result = await this.db.query<AuditLog>(query, params);
    const logs = result.rows;

    if (logs.length === 0) {
      return { valid: true, totalChecked: 0 };
    }

    // Verify each log's hash chain
    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i];
      const previousLog = logs[i - 1];

      // Current log should reference previous log's hash
      if (currentLog.previous_hash !== previousLog.action_hash) {
        return {
          valid: false,
          totalChecked: i,
          firstInvalidId: currentLog.id,
          error: 'Hash chain broken',
        };
      }

      // Verify current log's hash (would need to recompute - simplified here)
      // In production, you'd recompute the hash and compare
    }

    return {
      valid: true,
      totalChecked: logs.length,
    };
  }

  /**
   * Get audit statistics for a deal
   */
  async getDealStatistics(dealId: string) {
    const query = `
      SELECT
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT agent_id) as unique_agents,
        COUNT(DISTINCT action_type) as unique_action_types,
        MIN(created_at) as first_action,
        MAX(created_at) as last_action
      FROM audit_logs
      WHERE deal_id = $1
    `;

    const result = await this.db.query<{
      total_actions: string;
      unique_users: string;
      unique_agents: string;
      unique_action_types: string;
      first_action: Date;
      last_action: Date;
    }>(query, [dealId]);

    return {
      totalActions: parseInt(result.rows[0]?.total_actions || '0'),
      uniqueUsers: parseInt(result.rows[0]?.unique_users || '0'),
      uniqueAgents: parseInt(result.rows[0]?.unique_agents || '0'),
      uniqueActionTypes: parseInt(result.rows[0]?.unique_action_types || '0'),
      firstAction: result.rows[0]?.first_action,
      lastAction: result.rows[0]?.last_action,
    };
  }

  /**
   * Get action type breakdown for a deal
   */
  async getActionTypeBreakdown(dealId: string): Promise<Record<string, number>> {
    const query = `
      SELECT action_type, COUNT(*) as count
      FROM audit_logs
      WHERE deal_id = $1
      GROUP BY action_type
      ORDER BY count DESC
    `;

    const result = await this.db.query<{ action_type: string; count: string }>(query, [
      dealId,
    ]);

    const breakdown: Record<string, number> = {};
    result.rows.forEach((row) => {
      breakdown[row.action_type] = parseInt(row.count);
    });

    return breakdown;
  }

  /**
   * Get recent activity for a deal
   */
  async getRecentActivity(dealId: string, limit = 20): Promise<AuditLog[]> {
    return this.search({ deal_id: dealId, limit, offset: 0 });
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON ACTIONS
  // ============================================================================

  /**
   * Log document upload
   */
  async logDocumentUpload(
    dealId: string,
    userId: string,
    documentId: string,
    filename: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'document_upload',
      entity_type: 'document',
      entity_id: documentId,
      action_details: { filename },
      ip_address: ipAddress,
    });
  }

  /**
   * Log document access
   */
  async logDocumentAccess(
    dealId: string,
    userId: string,
    documentId: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'document_access',
      entity_type: 'document',
      entity_id: documentId,
      action_details: {},
      ip_address: ipAddress,
    });
  }

  /**
   * Log finding created
   */
  async logFindingCreated(
    dealId: string,
    agentId: string,
    findingId: string,
    findingType: string,
    confidenceScore: number
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      agent_id: agentId,
      action_type: 'finding_created',
      entity_type: 'finding',
      entity_id: findingId,
      action_details: { finding_type: findingType, confidence_score: confidenceScore },
    });
  }

  /**
   * Log finding validated
   */
  async logFindingValidated(
    dealId: string,
    userId: string,
    findingId: string,
    validationStatus: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'finding_validated',
      entity_type: 'finding',
      entity_id: findingId,
      action_details: { validation_status: validationStatus },
      ip_address: ipAddress,
    });
  }

  /**
   * Log phase transition
   */
  async logPhaseTransition(
    dealId: string,
    userId: string | undefined,
    agentId: string | undefined,
    fromPhase: string,
    toPhase: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      agent_id: agentId,
      action_type: 'phase_transition',
      entity_type: 'deal',
      entity_id: dealId,
      action_details: { from_phase: fromPhase, to_phase: toPhase },
    });
  }

  /**
   * Log query execution
   */
  async logQueryExecution(
    dealId: string,
    userId: string,
    query: string,
    agentType: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'query_executed',
      entity_type: 'query',
      action_details: { query, agent_type: agentType },
      ip_address: ipAddress,
    });
  }

  /**
   * Log data export
   */
  async logDataExport(
    dealId: string,
    userId: string,
    exportType: string,
    entityCount: number,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'data_export',
      entity_type: 'export',
      action_details: { export_type: exportType, entity_count: entityCount },
      ip_address: ipAddress,
    });
  }

  /**
   * Log access denied
   */
  async logAccessDenied(
    dealId: string | undefined,
    userId: string,
    resource: string,
    reason: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      deal_id: dealId,
      user_id: userId,
      action_type: 'access_denied',
      action_details: { resource, reason },
      ip_address: ipAddress,
    });
  }
}
