/**
 * Database Client
 * PostgreSQL client with connection pooling and deal isolation
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // Maximum pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | object;
}

export class DatabaseClient {
  private pool: Pool;
  private static instance: DatabaseClient;

  private constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      ssl: config.ssl,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });

    logger.info('Database pool initialized', {
      host: config.host,
      database: config.database,
      maxConnections: config.max || 20,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: DatabaseConfig): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      DatabaseClient.instance = new DatabaseClient(config);
    }
    return DatabaseClient.instance;
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration,
        rows: result.rowCount,
        query: text.substring(0, 100),
      });

      return result;
    } catch (error) {
      logger.error('Query error', {
        error: error instanceof Error ? error.message : String(error),
        query: text.substring(0, 100),
        params,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

/**
 * Initialize database client from environment variables
 */
export function initializeDatabase(): DatabaseClient {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'diligence_cubed',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_SIZE || '20'),
    ssl: process.env.DB_SSL === 'true',
  };

  return DatabaseClient.getInstance(config);
}
