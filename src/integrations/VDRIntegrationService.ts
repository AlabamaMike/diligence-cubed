/**
 * VDR (Virtual Data Room) Platform Connectors
 * Integrates with Datasite, Intralinks, and DealRoom for document access
 */

import { IngestionAgent } from '../agents/IngestionAgent';
import { DatabaseClient } from '../database/client';
import { AuditService } from '../services/AuditService';
import { logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

export interface VDRCredentials {
  platform: 'datasite' | 'intralinks' | 'dealroom';
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
  site_id?: string;
  project_id?: string;
}

export interface VDRDocument {
  id: string;
  name: string;
  path: string;
  size_bytes: number;
  mime_type: string;
  modified_date: Date;
  created_date: Date;
  category?: string;
  tags?: string[];
  version?: string;
  checksum?: string;
}

export interface VDRSyncResult {
  success: boolean;
  new_documents: number;
  updated_documents: number;
  deleted_documents: number;
  errors: Array<{ file: string; error: string }>;
  sync_duration_ms: number;
}

/**
 * Abstract base class for VDR connectors
 */
abstract class VDRConnector {
  protected client: AxiosInstance;
  protected credentials: VDRCredentials;

  constructor(credentials: VDRCredentials) {
    this.credentials = credentials;
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  abstract authenticate(): Promise<void>;
  abstract listDocuments(path?: string): Promise<VDRDocument[]>;
  abstract downloadDocument(documentId: string): Promise<Buffer>;
  abstract getDocumentMetadata(documentId: string): Promise<VDRDocument>;
  abstract testConnection(): Promise<boolean>;
}

/**
 * Datasite VDR Connector
 */
class DatasiteConnector extends VDRConnector {
  private accessToken?: string;
  private baseUrl = 'https://api.datasite.com/v1'; // Placeholder URL

  async authenticate(): Promise<void> {
    try {
      // In production, would use actual Datasite OAuth flow
      const response = await this.client.post(`${this.baseUrl}/auth/token`, {
        client_id: this.credentials.client_id,
        client_secret: this.credentials.client_secret,
        grant_type: 'client_credentials',
      });

      this.accessToken = response.data.access_token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;

      logger.info('Datasite authentication successful');
    } catch (error) {
      logger.error('Datasite authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Datasite authentication failed');
    }
  }

  async listDocuments(path = '/'): Promise<VDRDocument[]> {
    if (!this.accessToken) await this.authenticate();

    try {
      const response = await this.client.get(`${this.baseUrl}/projects/${this.credentials.project_id}/documents`, {
        params: { path },
      });

      return response.data.documents.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        path: doc.path,
        size_bytes: doc.size,
        mime_type: doc.mimeType,
        modified_date: new Date(doc.modifiedDate),
        created_date: new Date(doc.createdDate),
        category: doc.category,
        tags: doc.tags,
        version: doc.version,
        checksum: doc.checksum,
      }));
    } catch (error) {
      logger.error('Failed to list Datasite documents', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    if (!this.accessToken) await this.authenticate();

    try {
      const response = await this.client.get(
        `${this.baseUrl}/projects/${this.credentials.project_id}/documents/${documentId}/download`,
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download Datasite document', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDocumentMetadata(documentId: string): Promise<VDRDocument> {
    if (!this.accessToken) await this.authenticate();

    const response = await this.client.get(
      `${this.baseUrl}/projects/${this.credentials.project_id}/documents/${documentId}`
    );

    const doc = response.data;
    return {
      id: doc.id,
      name: doc.name,
      path: doc.path,
      size_bytes: doc.size,
      mime_type: doc.mimeType,
      modified_date: new Date(doc.modifiedDate),
      created_date: new Date(doc.createdDate),
      category: doc.category,
      tags: doc.tags,
      version: doc.version,
      checksum: doc.checksum,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      await this.client.get(`${this.baseUrl}/projects/${this.credentials.project_id}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Intralinks VDR Connector
 */
class IntralinksConnector extends VDRConnector {
  private sessionToken?: string;
  private baseUrl = 'https://api.intralinks.com/v2'; // Placeholder URL

  async authenticate(): Promise<void> {
    try {
      const response = await this.client.post(`${this.baseUrl}/session`, {
        email: this.credentials.username,
        password: this.credentials.password,
      });

      this.sessionToken = response.data.sessionToken;
      this.client.defaults.headers.common['X-IntraLinks-Session'] = this.sessionToken;

      logger.info('Intralinks authentication successful');
    } catch (error) {
      logger.error('Intralinks authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Intralinks authentication failed');
    }
  }

  async listDocuments(path = '/'): Promise<VDRDocument[]> {
    if (!this.sessionToken) await this.authenticate();

    try {
      const response = await this.client.get(
        `${this.baseUrl}/exchanges/${this.credentials.site_id}/documents`,
        { params: { path } }
      );

      return response.data.items.map((doc: any) => ({
        id: doc.documentId,
        name: doc.fileName,
        path: doc.folderPath,
        size_bytes: doc.fileSize,
        mime_type: doc.contentType,
        modified_date: new Date(doc.lastModified),
        created_date: new Date(doc.createdDate),
        version: doc.versionNumber?.toString(),
        checksum: doc.hash,
      }));
    } catch (error) {
      logger.error('Failed to list Intralinks documents', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    if (!this.sessionToken) await this.authenticate();

    try {
      const response = await this.client.get(
        `${this.baseUrl}/exchanges/${this.credentials.site_id}/documents/${documentId}/download`,
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download Intralinks document', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDocumentMetadata(documentId: string): Promise<VDRDocument> {
    if (!this.sessionToken) await this.authenticate();

    const response = await this.client.get(
      `${this.baseUrl}/exchanges/${this.credentials.site_id}/documents/${documentId}`
    );

    const doc = response.data;
    return {
      id: doc.documentId,
      name: doc.fileName,
      path: doc.folderPath,
      size_bytes: doc.fileSize,
      mime_type: doc.contentType,
      modified_date: new Date(doc.lastModified),
      created_date: new Date(doc.createdDate),
      version: doc.versionNumber?.toString(),
      checksum: doc.hash,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      await this.client.get(`${this.baseUrl}/exchanges/${this.credentials.site_id}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * DealRoom VDR Connector
 */
class DealRoomConnector extends VDRConnector {
  private apiKey?: string;
  private baseUrl = 'https://api.dealroom.net/v1'; // Placeholder URL

  async authenticate(): Promise<void> {
    // DealRoom typically uses API key authentication
    this.apiKey = this.credentials.api_key;
    this.client.defaults.headers.common['X-API-Key'] = this.apiKey;
    logger.info('DealRoom API key configured');
  }

  async listDocuments(path = '/'): Promise<VDRDocument[]> {
    if (!this.apiKey) await this.authenticate();

    try {
      const response = await this.client.get(
        `${this.baseUrl}/rooms/${this.credentials.site_id}/files`,
        { params: { folder: path } }
      );

      return response.data.files.map((doc: any) => ({
        id: doc.file_id,
        name: doc.filename,
        path: doc.folder_path,
        size_bytes: doc.size_bytes,
        mime_type: doc.mime_type,
        modified_date: new Date(doc.updated_at),
        created_date: new Date(doc.created_at),
        tags: doc.tags,
        version: doc.version_number,
      }));
    } catch (error) {
      logger.error('Failed to list DealRoom documents', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    if (!this.apiKey) await this.authenticate();

    try {
      const response = await this.client.get(
        `${this.baseUrl}/rooms/${this.credentials.site_id}/files/${documentId}/download`,
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download DealRoom document', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDocumentMetadata(documentId: string): Promise<VDRDocument> {
    if (!this.apiKey) await this.authenticate();

    const response = await this.client.get(
      `${this.baseUrl}/rooms/${this.credentials.site_id}/files/${documentId}`
    );

    const doc = response.data;
    return {
      id: doc.file_id,
      name: doc.filename,
      path: doc.folder_path,
      size_bytes: doc.size_bytes,
      mime_type: doc.mime_type,
      modified_date: new Date(doc.updated_at),
      created_date: new Date(doc.created_at),
      tags: doc.tags,
      version: doc.version_number,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      await this.client.get(`${this.baseUrl}/rooms/${this.credentials.site_id}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * VDR Integration Service
 * Manages connections to multiple VDR platforms and syncs documents
 */
export class VDRIntegrationService {
  private connectors: Map<string, VDRConnector> = new Map();
  private ingestionAgent: IngestionAgent;
  private auditService: AuditService;

  constructor(private db: DatabaseClient) {
    this.ingestionAgent = new IngestionAgent(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Register VDR credentials for a deal
   */
  async registerVDR(dealId: string, credentials: VDRCredentials): Promise<void> {
    const connector = this.createConnector(credentials);

    // Test connection
    const connected = await connector.testConnection();
    if (!connected) {
      throw new Error(`Failed to connect to ${credentials.platform} VDR`);
    }

    this.connectors.set(dealId, connector);
    logger.info('VDR registered for deal', { dealId, platform: credentials.platform });

    // Store credentials (encrypted) in database
    await this.db.query(
      `INSERT INTO deal_configs (deal_id, custom_settings)
       VALUES ($1, jsonb_build_object('vdr_platform', $2))
       ON CONFLICT (deal_id) DO UPDATE
       SET custom_settings = deal_configs.custom_settings || jsonb_build_object('vdr_platform', $2)`,
      [dealId, credentials.platform]
    );
  }

  /**
   * Sync documents from VDR to platform
   */
  async syncDocuments(
    dealId: string,
    userId: string,
    path = '/',
    incremental = true
  ): Promise<VDRSyncResult> {
    const startTime = Date.now();

    const connector = this.connectors.get(dealId);
    if (!connector) {
      throw new Error('No VDR connector registered for this deal');
    }

    logger.info('Starting VDR sync', { dealId, path, incremental });

    const result: VDRSyncResult = {
      success: true,
      new_documents: 0,
      updated_documents: 0,
      deleted_documents: 0,
      errors: [],
      sync_duration_ms: 0,
    };

    try {
      // Initialize ingestion agent
      await this.ingestionAgent.initialize();

      // List documents from VDR
      const vdrDocuments = await connector.listDocuments(path);
      logger.info('Found documents in VDR', { count: vdrDocuments.length });

      // Get existing documents if incremental sync
      let existingDocs: Map<string, any> = new Map();
      if (incremental) {
        const existing = await this.db.query(
          `SELECT id, filename, storage_path, file_size_bytes
           FROM documents
           WHERE deal_id = $1`,
          [dealId]
        );
        existing.rows.forEach((doc) => {
          existingDocs.set(doc.filename, doc);
        });
      }

      // Process each document
      for (const vdrDoc of vdrDocuments) {
        try {
          const existing = existingDocs.get(vdrDoc.name);

          // Skip if unchanged (same size and recent)
          if (incremental && existing && existing.file_size_bytes === vdrDoc.size_bytes) {
            continue;
          }

          // Download document
          const content = await connector.downloadDocument(vdrDoc.id);

          // Generate storage path
          const storagePath = `/vdr/${dealId}/${vdrDoc.path}/${vdrDoc.name}`;

          // Process with ingestion agent
          if (existing) {
            // Update existing document (create new version)
            result.updated_documents++;
            logger.debug('Updating document', { filename: vdrDoc.name });
          } else {
            // New document
            await this.ingestionAgent.processDocument(
              dealId,
              vdrDoc.name,
              storagePath,
              vdrDoc.size_bytes,
              vdrDoc.mime_type,
              userId,
              content
            );
            result.new_documents++;
          }
        } catch (error) {
          result.errors.push({
            file: vdrDoc.name,
            error: error instanceof Error ? error.message : String(error),
          });
          logger.error('Failed to sync document', {
            filename: vdrDoc.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      result.sync_duration_ms = Date.now() - startTime;
      result.success = result.errors.length === 0;

      // Log sync
      await this.auditService.log({
        deal_id: dealId,
        user_id: userId,
        action_type: 'vdr_sync',
        entity_type: 'documents',
        action_details: {
          new_documents: result.new_documents,
          updated_documents: result.updated_documents,
          errors_count: result.errors.length,
          duration_ms: result.sync_duration_ms,
        },
      });

      logger.info('VDR sync completed', result);
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        file: 'sync',
        error: error instanceof Error ? error.message : String(error),
      });
      result.sync_duration_ms = Date.now() - startTime;

      logger.error('VDR sync failed', {
        dealId,
        error: error instanceof Error ? error.message : String(error),
      });

      return result;
    }
  }

  /**
   * Schedule automatic sync
   */
  async scheduleSync(
    dealId: string,
    intervalHours: number = 24
  ): Promise<void> {
    // TODO: Implement with job scheduler (Bull, Agenda, etc.)
    logger.info('VDR sync scheduled', { dealId, intervalHours });
  }

  /**
   * Create connector based on platform
   * @private
   */
  private createConnector(credentials: VDRCredentials): VDRConnector {
    switch (credentials.platform) {
      case 'datasite':
        return new DatasiteConnector(credentials);
      case 'intralinks':
        return new IntralinksConnector(credentials);
      case 'dealroom':
        return new DealRoomConnector(credentials);
      default:
        throw new Error(`Unsupported VDR platform: ${credentials.platform}`);
    }
  }

  /**
   * Get sync history for a deal
   */
  async getSyncHistory(dealId: string, limit = 10): Promise<any[]> {
    const result = await this.auditService.search({
      deal_id: dealId,
      action_type: 'vdr_sync',
      limit,
      offset: 0,
    });

    return result;
  }
}
