/**
 * RBAC Service
 * Role-Based Access Control with deal isolation
 */

import { DatabaseClient } from '../database/client';
import { User, UserRole, DealAccess, AccessLevel } from '../types/database';
import { logger } from '../utils/logger';

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  api_key?: string;
}

export interface GrantAccessInput {
  deal_id: string;
  user_id: string;
  access_level: AccessLevel;
  workstreams?: string[];
  granted_by: string;
  expires_at?: Date;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  accessLevel?: AccessLevel;
  reason?: string;
  workstreams?: string[];
}

export class RBACService {
  constructor(private db: DatabaseClient) {}

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    // Hash API key if provided
    const apiKeyHash = input.api_key
      ? await this.hashApiKey(input.api_key)
      : null;

    const query = `
      INSERT INTO users (email, name, role, api_key_hash, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING *
    `;

    const result = await this.db.query<User>(query, [
      input.email,
      input.name,
      input.role,
      apiKeyHash,
    ]);

    logger.info('User created', { userId: result.rows[0].id, email: input.email, role: input.role });
    return result.rows[0];
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query<User>(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query<User>(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Get user by API key
   */
  async getUserByApiKey(apiKey: string): Promise<User | null> {
    const apiKeyHash = await this.hashApiKey(apiKey);
    const query = 'SELECT * FROM users WHERE api_key_hash = $1 AND status = $2';
    const result = await this.db.query<User>(query, [apiKeyHash, 'active']);

    if (result.rows[0]) {
      // Update last login
      await this.db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [result.rows[0].id]
      );
    }

    return result.rows[0] || null;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<User | null> {
    const query = `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query<User>(query, [newRole, userId]);
    logger.info('User role updated', { userId, newRole });
    return result.rows[0] || null;
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string): Promise<User | null> {
    const query = `
      UPDATE users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<User>(query, [userId]);
    logger.info('User deactivated', { userId });
    return result.rows[0] || null;
  }

  // ============================================================================
  // ACCESS CONTROL
  // ============================================================================

  /**
   * Grant access to a deal
   */
  async grantAccess(input: GrantAccessInput): Promise<DealAccess> {
    const query = `
      INSERT INTO deal_access (
        deal_id, user_id, access_level, workstreams,
        granted_by, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (deal_id, user_id)
      DO UPDATE SET
        access_level = EXCLUDED.access_level,
        workstreams = EXCLUDED.workstreams,
        expires_at = EXCLUDED.expires_at
      RETURNING *
    `;

    const result = await this.db.query<DealAccess>(query, [
      input.deal_id,
      input.user_id,
      input.access_level,
      input.workstreams,
      input.granted_by,
      input.expires_at,
    ]);

    logger.info('Access granted', {
      dealId: input.deal_id,
      userId: input.user_id,
      accessLevel: input.access_level,
    });

    return result.rows[0];
  }

  /**
   * Revoke access to a deal
   */
  async revokeAccess(dealId: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM deal_access WHERE deal_id = $1 AND user_id = $2';
    const result = await this.db.query(query, [dealId, userId]);

    logger.info('Access revoked', { dealId, userId });
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if user has access to a deal
   */
  async checkAccess(userId: string, dealId: string): Promise<AccessCheckResult> {
    // Get user
    const user = await this.getUserById(userId);
    if (!user) {
      return {
        hasAccess: false,
        reason: 'User not found',
      };
    }

    // Check if user is inactive
    if (user.status !== 'active') {
      return {
        hasAccess: false,
        reason: 'User is not active',
      };
    }

    // Partners and admins have access to all deals
    if (user.role === 'partner' || user.role === 'admin') {
      return {
        hasAccess: true,
        accessLevel: 'full',
      };
    }

    // Check deal access
    const query = `
      SELECT * FROM deal_access
      WHERE user_id = $1 AND deal_id = $2
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const result = await this.db.query<DealAccess>(query, [userId, dealId]);

    if (result.rows.length === 0) {
      return {
        hasAccess: false,
        reason: 'No access granted for this deal',
      };
    }

    const access = result.rows[0];
    return {
      hasAccess: true,
      accessLevel: access.access_level,
      workstreams: access.workstreams || undefined,
    };
  }

  /**
   * Check if user has access to a specific workstream
   */
  async checkWorkstreamAccess(
    userId: string,
    dealId: string,
    workstreamId: string
  ): Promise<boolean> {
    const access = await this.checkAccess(userId, dealId);

    if (!access.hasAccess) {
      return false;
    }

    // Full access grants access to all workstreams
    if (access.accessLevel === 'full') {
      return true;
    }

    // Check workstream-specific access
    if (access.accessLevel === 'workstream_specific' && access.workstreams) {
      // Get workstream name
      const wsResult = await this.db.query(
        'SELECT name FROM workstreams WHERE id = $1',
        [workstreamId]
      );

      if (wsResult.rows.length === 0) {
        return false;
      }

      const workstreamName = wsResult.rows[0].name;
      return access.workstreams.includes(workstreamName);
    }

    return false;
  }

  /**
   * Get all users with access to a deal
   */
  async getDealUsers(dealId: string): Promise<Array<User & { access_level: AccessLevel }>> {
    const query = `
      SELECT u.*, da.access_level
      FROM users u
      INNER JOIN deal_access da ON da.user_id = u.id
      WHERE da.deal_id = $1
      AND (da.expires_at IS NULL OR da.expires_at > NOW())
      ORDER BY u.name
    `;

    const result = await this.db.query<User & { access_level: AccessLevel }>(query, [dealId]);
    return result.rows;
  }

  /**
   * Get all deals accessible by a user
   */
  async getUserDeals(userId: string): Promise<string[]> {
    // Check if user has admin/partner role
    const user = await this.getUserById(userId);
    if (!user) {
      return [];
    }

    if (user.role === 'partner' || user.role === 'admin') {
      // Return all active deals
      const result = await this.db.query<{ id: string }>(
        `SELECT id FROM deals WHERE status = 'active'`
      );
      return result.rows.map((r) => r.id);
    }

    // Return deals with explicit access
    const query = `
      SELECT DISTINCT deal_id
      FROM deal_access
      WHERE user_id = $1
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const result = await this.db.query<{ deal_id: string }>(query, [userId]);
    return result.rows.map((r) => r.deal_id);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE role = $1 AND status = $2 ORDER BY name';
    const result = await this.db.query<User>(query, [role, 'active']);
    return result.rows;
  }

  // ============================================================================
  // ROLE PERMISSIONS
  // ============================================================================

  /**
   * Check if user can perform action
   */
  canPerformAction(userRole: UserRole, action: string): boolean {
    const rolePermissions: Record<UserRole, string[]> = {
      admin: ['*'], // All actions
      partner: [
        'create_deal',
        'update_deal',
        'delete_deal',
        'grant_access',
        'revoke_access',
        'approve_plan',
        'validate_finding',
        'transition_phase',
        'export_data',
      ],
      manager: [
        'create_deal',
        'update_deal',
        'grant_access',
        'approve_plan',
        'validate_finding',
        'transition_phase',
        'export_data',
      ],
      lead: [
        'update_deal',
        'validate_finding',
        'create_finding',
        'upload_document',
        'export_data',
      ],
      analyst: [
        'create_finding',
        'upload_document',
        'query_agent',
      ],
      client_viewer: [
        'view_findings',
        'view_documents',
      ],
      auditor: [
        'view_audit_logs',
        'view_findings',
        'view_documents',
      ],
    };

    const permissions = rolePermissions[userRole] || [];
    return permissions.includes('*') || permissions.includes(action);
  }

  /**
   * Require permission for action
   */
  async requirePermission(userId: string, action: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!this.canPerformAction(user.role, action)) {
      throw new Error(`Permission denied: User role '${user.role}' cannot perform '${action}'`);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Hash API key
   * @private
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    // In production, use bcrypt or similar
    // For now, using simple hash
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Generate API key
   */
  generateApiKey(): string {
    const crypto = require('crypto');
    return `dc_${crypto.randomBytes(32).toString('hex')}`;
  }
}
