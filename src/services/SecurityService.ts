/**
 * Security Service
 * Advanced security controls, encryption, key management, and data protection
 */

import { DatabaseClient } from '../database/client';
import { AuditService } from './AuditService';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EncryptionKey {
  id: string;
  key_name: string;
  deal_id?: string;
  key_type: 'master' | 'deal' | 'field' | 'document';
  algorithm: string;
  key_value_encrypted: string;
  initialization_vector: string;
  status: 'active' | 'rotating' | 'retired';
  rotation_schedule_days?: number;
  last_rotated_at?: Date;
  next_rotation_at?: Date;
  created_at: Date;
  retired_at?: Date;
}

export interface SensitiveField {
  table_name: string;
  column_name: string;
  encryption_required: boolean;
  masking_pattern?: string; // e.g., "****-****-****-{last4}"
  access_roles: string[];
}

export interface DataAccessLog {
  id: string;
  user_id: string;
  deal_id: string;
  resource_type: string;
  resource_id: string;
  action: 'read' | 'write' | 'delete' | 'export';
  ip_address?: string;
  user_agent?: string;
  access_granted: boolean;
  denial_reason?: string;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_name: string;
  key_hash: string;
  key_prefix: string; // First 8 chars for identification
  scopes: string[];
  deal_access?: string[]; // Specific deal IDs this key can access
  rate_limit_per_hour?: number;
  expires_at?: Date;
  last_used_at?: Date;
  status: 'active' | 'expired' | 'revoked';
  created_at: Date;
}

export interface SessionToken {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string;
  user_agent: string;
  expires_at: Date;
  last_activity_at: Date;
  created_at: Date;
}

// ============================================================================
// SECURITY SERVICE
// ============================================================================

export class SecurityService {
  private auditService: AuditService;
  private masterKey: Buffer;
  private algorithm: string = 'aes-256-gcm';
  private keyCache: Map<string, Buffer> = new Map();

  constructor(private db: DatabaseClient) {
    this.auditService = new AuditService(db);
    this.masterKey = this.loadMasterKey();
    this.initializeDatabase();
  }

  /**
   * Load master encryption key from environment
   */
  private loadMasterKey(): Buffer {
    const masterKeyHex = process.env.MASTER_ENCRYPTION_KEY;

    if (!masterKeyHex) {
      logger.warn('No master encryption key found, generating temporary key');
      // In production, this should fail - for dev, generate temp key
      return crypto.randomBytes(32);
    }

    return Buffer.from(masterKeyHex, 'hex');
  }

  /**
   * Initialize database tables
   */
  private async initializeDatabase(): Promise<void> {
    // Create encryption_keys table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_name VARCHAR(255) NOT NULL UNIQUE,
        deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
        key_type VARCHAR(20) NOT NULL,
        algorithm VARCHAR(50) NOT NULL,
        key_value_encrypted TEXT NOT NULL,
        initialization_vector TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        rotation_schedule_days INTEGER,
        last_rotated_at TIMESTAMPTZ,
        next_rotation_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        retired_at TIMESTAMPTZ,
        INDEX idx_encryption_keys_deal (deal_id),
        INDEX idx_encryption_keys_status (status),
        INDEX idx_encryption_keys_type (key_type)
      );
    `);

    // Create sensitive_fields table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS sensitive_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name VARCHAR(100) NOT NULL,
        column_name VARCHAR(100) NOT NULL,
        encryption_required BOOLEAN DEFAULT true,
        masking_pattern VARCHAR(255),
        access_roles JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (table_name, column_name)
      );
    `);

    // Create data_access_logs table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS data_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(100) NOT NULL,
        deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID NOT NULL,
        action VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        access_granted BOOLEAN NOT NULL,
        denial_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_data_access_logs_user (user_id),
        INDEX idx_data_access_logs_deal (deal_id),
        INDEX idx_data_access_logs_resource (resource_type, resource_id),
        INDEX idx_data_access_logs_created (created_at)
      );
    `);

    // Create api_keys table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(100) NOT NULL,
        key_name VARCHAR(255) NOT NULL,
        key_hash TEXT NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]',
        deal_access JSONB,
        rate_limit_per_hour INTEGER DEFAULT 1000,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_api_keys_user (user_id),
        INDEX idx_api_keys_prefix (key_prefix),
        INDEX idx_api_keys_status (status)
      );
    `);

    // Create session_tokens table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS session_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(100) NOT NULL,
        token_hash TEXT NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_session_tokens_user (user_id),
        INDEX idx_session_tokens_hash (token_hash),
        INDEX idx_session_tokens_expires (expires_at)
      );
    `);

    logger.info('Security database initialized');
  }

  // ==========================================================================
  // ENCRYPTION KEY MANAGEMENT
  // ==========================================================================

  /**
   * Generate new encryption key for a deal
   */
  async generateDealKey(dealId: string, rotationScheduleDays: number = 90): Promise<string> {
    logger.info('Generating deal encryption key', { dealId });

    // Generate random 256-bit key
    const dealKey = crypto.randomBytes(32);

    // Generate IV for encrypting the deal key with master key
    const iv = crypto.randomBytes(16);

    // Encrypt deal key with master key
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    const encryptedKey = Buffer.concat([
      cipher.update(dealKey),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    const keyName = `deal_${dealId}`;
    const nextRotation = new Date(Date.now() + rotationScheduleDays * 24 * 60 * 60 * 1000);

    // Store in database
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO encryption_keys
       (key_name, deal_id, key_type, algorithm, key_value_encrypted, initialization_vector,
        rotation_schedule_days, next_rotation_at)
       VALUES ($1, $2, 'deal', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        keyName,
        dealId,
        this.algorithm,
        encryptedKey.toString('base64'),
        iv.toString('base64'),
        rotationScheduleDays,
        nextRotation,
      ]
    );

    // Cache the decrypted key
    this.keyCache.set(keyName, dealKey);

    logger.info('Deal encryption key generated', { keyId: result.rows[0].id });
    return result.rows[0].id;
  }

  /**
   * Get decrypted deal key
   */
  async getDealKey(dealId: string): Promise<Buffer> {
    const keyName = `deal_${dealId}`;

    // Check cache first
    if (this.keyCache.has(keyName)) {
      return this.keyCache.get(keyName)!;
    }

    // Load from database
    const result = await this.db.query<EncryptionKey>(
      `SELECT * FROM encryption_keys
       WHERE key_name = $1 AND status = 'active'`,
      [keyName]
    );

    if (result.rows.length === 0) {
      throw new Error(`No active encryption key found for deal: ${dealId}`);
    }

    const keyRecord = result.rows[0];

    // Decrypt the deal key
    const encryptedKey = Buffer.from(keyRecord.key_value_encrypted, 'base64');
    const iv = Buffer.from(keyRecord.initialization_vector, 'base64');

    const authTag = encryptedKey.slice(-16);
    const ciphertext = encryptedKey.slice(0, -16);

    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    const dealKey = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Cache it
    this.keyCache.set(keyName, dealKey);

    return dealKey;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<string> {
    logger.info('Rotating encryption key', { keyId });

    // Get current key
    const currentKeyResult = await this.db.query<EncryptionKey>(
      'SELECT * FROM encryption_keys WHERE id = $1',
      [keyId]
    );

    if (currentKeyResult.rows.length === 0) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const currentKey = currentKeyResult.rows[0];

    // Generate new key
    const newKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    const encryptedKey = Buffer.concat([
      cipher.update(newKey),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // Mark old key as rotating
    await this.db.query(
      'UPDATE encryption_keys SET status = \'rotating\' WHERE id = $1',
      [keyId]
    );

    // Create new key version
    const nextRotation = currentKey.rotation_schedule_days
      ? new Date(Date.now() + currentKey.rotation_schedule_days * 24 * 60 * 60 * 1000)
      : null;

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO encryption_keys
       (key_name, deal_id, key_type, algorithm, key_value_encrypted, initialization_vector,
        rotation_schedule_days, next_rotation_at, last_rotated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        currentKey.key_name,
        currentKey.deal_id,
        currentKey.key_type,
        this.algorithm,
        encryptedKey.toString('base64'),
        iv.toString('base64'),
        currentKey.rotation_schedule_days,
        nextRotation,
      ]
    );

    const newKeyId = result.rows[0].id;

    // Update cache
    if (this.keyCache.has(currentKey.key_name)) {
      this.keyCache.set(currentKey.key_name, newKey);
    }

    // TODO: Re-encrypt all data encrypted with old key (would be done async)

    // Retire old key after re-encryption complete
    await this.db.query(
      `UPDATE encryption_keys
       SET status = 'retired', retired_at = NOW()
       WHERE id = $1`,
      [keyId]
    );

    logger.info('Key rotation completed', { oldKeyId: keyId, newKeyId });
    return newKeyId;
  }

  /**
   * Check for keys due for rotation
   */
  async checkKeyRotations(): Promise<void> {
    const dueForRotation = await this.db.query<EncryptionKey>(
      `SELECT * FROM encryption_keys
       WHERE status = 'active'
       AND next_rotation_at IS NOT NULL
       AND next_rotation_at < NOW()`
    );

    for (const key of dueForRotation.rows) {
      try {
        await this.rotateKey(key.id);
      } catch (error) {
        logger.error('Failed to rotate key', {
          keyId: key.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ==========================================================================
  // FIELD-LEVEL ENCRYPTION
  // ==========================================================================

  /**
   * Encrypt sensitive field value
   */
  async encryptField(dealId: string, value: string): Promise<string> {
    const dealKey = await this.getDealKey(dealId);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, dealKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // Format: iv:encrypted:authTag (all base64)
    return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /**
   * Decrypt sensitive field value
   */
  async decryptField(dealId: string, encryptedValue: string): Promise<string> {
    const dealKey = await this.getDealKey(dealId);

    // Parse format: iv:encrypted
    const parts = encryptedValue.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = Buffer.from(parts[1], 'base64');

    const authTag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(0, -16);

    const decipher = crypto.createDecipheriv(this.algorithm, dealKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Mask sensitive field for display
   */
  maskField(value: string, pattern?: string): string {
    if (!pattern) {
      // Default masking: show last 4 chars
      if (value.length <= 4) {
        return '****';
      }
      return '*'.repeat(value.length - 4) + value.slice(-4);
    }

    // Custom pattern (e.g., "****-****-{last4}")
    return pattern.replace('{last4}', value.slice(-4));
  }

  /**
   * Register sensitive field
   */
  async registerSensitiveField(
    tableName: string,
    columnName: string,
    accessRoles: string[],
    maskingPattern?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO sensitive_fields
       (table_name, column_name, encryption_required, masking_pattern, access_roles)
       VALUES ($1, $2, true, $3, $4)
       ON CONFLICT (table_name, column_name) DO UPDATE
       SET masking_pattern = $3, access_roles = $4`,
      [tableName, columnName, maskingPattern || null, JSON.stringify(accessRoles)]
    );
  }

  // ==========================================================================
  // API KEY MANAGEMENT
  // ==========================================================================

  /**
   * Generate new API key
   */
  async generateApiKey(
    userId: string,
    keyName: string,
    scopes: string[],
    dealAccess?: string[],
    expiresInDays?: number
  ): Promise<{ key: string; keyId: string }> {
    logger.info('Generating API key', { userId, keyName });

    // Generate random API key
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.substring(0, 12); // For identification

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO api_keys
       (user_id, key_name, key_hash, key_prefix, scopes, deal_access, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        keyName,
        keyHash,
        keyPrefix,
        JSON.stringify(scopes),
        dealAccess ? JSON.stringify(dealAccess) : null,
        expiresAt,
      ]
    );

    logger.info('API key generated', { keyId: result.rows[0].id });

    // Return the actual key (only time it's shown)
    return { key, keyId: result.rows[0].id };
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<{
    valid: boolean;
    userId?: string;
    scopes?: string[];
    dealAccess?: string[];
  }> {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const result = await this.db.query<ApiKey>(
      `SELECT * FROM api_keys
       WHERE key_hash = $1 AND status = 'active'`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const apiKey = result.rows[0];

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      await this.db.query(
        'UPDATE api_keys SET status = \'expired\' WHERE id = $1',
        [apiKey.id]
      );
      return { valid: false };
    }

    // Update last used
    await this.db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKey.id]
    );

    return {
      valid: true,
      userId: apiKey.user_id,
      scopes: typeof apiKey.scopes === 'string' ? JSON.parse(apiKey.scopes) : apiKey.scopes,
      dealAccess:
        apiKey.deal_access && typeof apiKey.deal_access === 'string'
          ? JSON.parse(apiKey.deal_access)
          : apiKey.deal_access,
    };
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    logger.info('Revoking API key', { keyId });

    await this.db.query(
      'UPDATE api_keys SET status = \'revoked\' WHERE id = $1',
      [keyId]
    );
  }

  /**
   * List API keys for user
   */
  async listApiKeys(userId: string): Promise<
    Array<{
      id: string;
      key_name: string;
      key_prefix: string;
      scopes: string[];
      created_at: Date;
      last_used_at?: Date;
      expires_at?: Date;
      status: string;
    }>
  > {
    const result = await this.db.query<ApiKey>(
      'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map((key) => ({
      id: key.id,
      key_name: key.key_name,
      key_prefix: key.key_prefix,
      scopes: typeof key.scopes === 'string' ? JSON.parse(key.scopes) : key.scopes,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      status: key.status,
    }));
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Create session token
   */
  async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    durationHours: number = 24
  ): Promise<string> {
    // Generate secure random token
    const token = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO session_tokens
       (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, ipAddress, userAgent, expiresAt]
    );

    logger.info('Session created', { userId });
    return token;
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<{ valid: boolean; userId?: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await this.db.query<SessionToken>(
      `SELECT * FROM session_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const session = result.rows[0];

    // Update last activity
    await this.db.query(
      'UPDATE session_tokens SET last_activity_at = NOW() WHERE id = $1',
      [session.id]
    );

    return { valid: true, userId: session.user_id };
  }

  /**
   * Invalidate session
   */
  async invalidateSession(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.db.query(
      'DELETE FROM session_tokens WHERE token_hash = $1',
      [tokenHash]
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'DELETE FROM session_tokens WHERE expires_at < NOW() RETURNING *'
    );

    const deletedCount = result.rowCount || 0;
    logger.info('Cleaned up expired sessions', { count: deletedCount });
    return deletedCount;
  }

  // ==========================================================================
  // DATA ACCESS LOGGING
  // ==========================================================================

  /**
   * Log data access attempt
   */
  async logDataAccess(
    userId: string,
    dealId: string,
    resourceType: string,
    resourceId: string,
    action: DataAccessLog['action'],
    accessGranted: boolean,
    ipAddress?: string,
    userAgent?: string,
    denialReason?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO data_access_logs
       (user_id, deal_id, resource_type, resource_id, action, ip_address, user_agent,
        access_granted, denial_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        dealId,
        resourceType,
        resourceId,
        action,
        ipAddress || null,
        userAgent || null,
        accessGranted,
        denialReason || null,
      ]
    );

    // Also log in audit trail if access was denied
    if (!accessGranted) {
      await this.auditService.log(
        dealId,
        userId,
        'access_denied',
        {
          resource_type: resourceType,
          resource_id: resourceId,
          action,
          reason: denialReason,
        },
        { ip_address: ipAddress }
      );
    }
  }

  /**
   * Get data access logs for a resource
   */
  async getAccessLogs(
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ): Promise<DataAccessLog[]> {
    const result = await this.db.query<DataAccessLog>(
      `SELECT * FROM data_access_logs
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [resourceType, resourceId, limit]
    );

    return result.rows;
  }

  /**
   * Get suspicious access patterns
   */
  async getSuspiciousActivity(dealId: string): Promise<
    Array<{
      user_id: string;
      failed_attempts: number;
      distinct_resources: number;
      last_attempt: Date;
    }>
  > {
    const result = await this.db.query<{
      user_id: string;
      failed_attempts: string;
      distinct_resources: string;
      last_attempt: Date;
    }>(
      `SELECT
        user_id,
        COUNT(*) as failed_attempts,
        COUNT(DISTINCT resource_id) as distinct_resources,
        MAX(created_at) as last_attempt
       FROM data_access_logs
       WHERE deal_id = $1
       AND access_granted = false
       AND created_at > NOW() - INTERVAL '1 hour'
       GROUP BY user_id
       HAVING COUNT(*) > 5
       ORDER BY failed_attempts DESC`,
      [dealId]
    );

    return result.rows.map((row) => ({
      user_id: row.user_id,
      failed_attempts: parseInt(row.failed_attempts),
      distinct_resources: parseInt(row.distinct_resources),
      last_attempt: row.last_attempt,
    }));
  }

  // ==========================================================================
  // DOCUMENT ENCRYPTION
  // ==========================================================================

  /**
   * Encrypt document content
   */
  async encryptDocument(dealId: string, content: Buffer): Promise<{
    encrypted: Buffer;
    iv: string;
  }> {
    const dealKey = await this.getDealKey(dealId);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, dealKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(content),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return {
      encrypted,
      iv: iv.toString('base64'),
    };
  }

  /**
   * Decrypt document content
   */
  async decryptDocument(dealId: string, encrypted: Buffer, iv: string): Promise<Buffer> {
    const dealKey = await this.getDealKey(dealId);
    const ivBuffer = Buffer.from(iv, 'base64');

    const authTag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(0, -16);

    const decipher = crypto.createDecipheriv(this.algorithm, dealKey, ivBuffer);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Generate secure random token
   */
  generateSecureToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /**
   * Hash password (for user authentication)
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password hash
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}
