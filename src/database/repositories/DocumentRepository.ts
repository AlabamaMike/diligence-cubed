/**
 * Document Repository
 * Data access layer for document management with hierarchical structure
 */

import { DatabaseClient } from '../client';
import { Document, ProcessingStatus, ExtractionStatus } from '../../types/database';
import { logger } from '../../utils/logger';

export interface CreateDocumentInput {
  deal_id: string;
  phase_id?: string;
  workstream_id?: string;
  filename: string;
  original_path?: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type?: string;
  uploaded_by?: string;
}

export interface UpdateDocumentInput {
  document_type?: string;
  classification_confidence?: number;
  tags?: string[];
  extracted_text?: string;
  extracted_text_status?: ExtractionStatus;
  page_count?: number;
  vector_namespace?: string;
  processing_status?: ProcessingStatus;
  processing_error?: string;
  processed_at?: Date;
}

export class DocumentRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Create a new document record
   */
  async create(input: CreateDocumentInput): Promise<Document> {
    const query = `
      INSERT INTO documents (
        deal_id, phase_id, workstream_id, filename, original_path,
        storage_path, file_size_bytes, mime_type, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      input.deal_id,
      input.phase_id,
      input.workstream_id,
      input.filename,
      input.original_path,
      input.storage_path,
      input.file_size_bytes,
      input.mime_type,
      input.uploaded_by,
    ];

    const result = await this.db.query<Document>(query, values);
    logger.info('Document created', {
      documentId: result.rows[0].id,
      dealId: input.deal_id,
      filename: input.filename,
    });
    return result.rows[0];
  }

  /**
   * Get document by ID
   */
  async findById(documentId: string): Promise<Document | null> {
    const query = 'SELECT * FROM documents WHERE id = $1';
    const result = await this.db.query<Document>(query, [documentId]);
    return result.rows[0] || null;
  }

  /**
   * Get documents by deal
   */
  async findByDeal(dealId: string, limit = 100, offset = 0): Promise<Document[]> {
    const query = `
      SELECT * FROM documents
      WHERE deal_id = $1
      ORDER BY uploaded_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<Document>(query, [dealId, limit, offset]);
    return result.rows;
  }

  /**
   * Get documents by workstream
   */
  async findByWorkstream(workstreamId: string, limit = 100, offset = 0): Promise<Document[]> {
    const query = `
      SELECT * FROM documents
      WHERE workstream_id = $1
      ORDER BY uploaded_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<Document>(query, [workstreamId, limit, offset]);
    return result.rows;
  }

  /**
   * Get documents by type
   */
  async findByType(
    dealId: string,
    documentType: string,
    limit = 100,
    offset = 0
  ): Promise<Document[]> {
    const query = `
      SELECT * FROM documents
      WHERE deal_id = $1 AND document_type = $2
      ORDER BY uploaded_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await this.db.query<Document>(query, [
      dealId,
      documentType,
      limit,
      offset,
    ]);
    return result.rows;
  }

  /**
   * Update document
   */
  async update(documentId: string, input: UpdateDocumentInput): Promise<Document | null> {
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
      return this.findById(documentId);
    }

    values.push(documentId);
    const query = `
      UPDATE documents
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query<Document>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(
    documentId: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<Document | null> {
    const query = `
      UPDATE documents
      SET processing_status = $1, processing_error = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.db.query<Document>(query, [status, error, documentId]);
    logger.info('Document processing status updated', { documentId, status });
    return result.rows[0] || null;
  }

  /**
   * Mark document as indexed
   */
  async markAsIndexed(documentId: string): Promise<Document | null> {
    const query = `
      UPDATE documents
      SET processing_status = 'indexed', processed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<Document>(query, [documentId]);
    return result.rows[0] || null;
  }

  /**
   * Get documents pending processing
   */
  async findPendingProcessing(dealId?: string, limit = 50): Promise<Document[]> {
    let query = `
      SELECT * FROM documents
      WHERE processing_status IN ('uploaded', 'classifying', 'extracting')
    `;

    const params: any[] = [];
    if (dealId) {
      params.push(dealId);
      query += ` AND deal_id = $1`;
    }

    query += `
      ORDER BY uploaded_at ASC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await this.db.query<Document>(query, params);
    return result.rows;
  }

  /**
   * Create document version
   */
  async createVersion(parentDocumentId: string, input: CreateDocumentInput): Promise<Document> {
    // Mark parent document as not latest
    await this.db.query(
      `UPDATE documents SET is_latest_version = false WHERE id = $1`,
      [parentDocumentId]
    );

    // Get parent version
    const parent = await this.findById(parentDocumentId);
    const newVersion = (parent?.version || 0) + 1;

    // Create new version
    const query = `
      INSERT INTO documents (
        deal_id, phase_id, workstream_id, filename, original_path,
        storage_path, file_size_bytes, mime_type, uploaded_by,
        parent_document_id, version, is_latest_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *
    `;

    const values = [
      input.deal_id,
      input.phase_id,
      input.workstream_id,
      input.filename,
      input.original_path,
      input.storage_path,
      input.file_size_bytes,
      input.mime_type,
      input.uploaded_by,
      parentDocumentId,
      newVersion,
    ];

    const result = await this.db.query<Document>(query, values);
    logger.info('Document version created', {
      documentId: result.rows[0].id,
      parentId: parentDocumentId,
      version: newVersion,
    });
    return result.rows[0];
  }

  /**
   * Get document versions
   */
  async getVersions(documentId: string): Promise<Document[]> {
    const query = `
      WITH RECURSIVE version_tree AS (
        SELECT * FROM documents WHERE id = $1
        UNION ALL
        SELECT d.* FROM documents d
        INNER JOIN version_tree vt ON d.parent_document_id = vt.id
      )
      SELECT * FROM version_tree
      ORDER BY version DESC
    `;

    const result = await this.db.query<Document>(query, [documentId]);
    return result.rows;
  }

  /**
   * Search documents by filename or content
   */
  async search(
    dealId: string,
    searchTerm: string,
    limit = 50
  ): Promise<Document[]> {
    const query = `
      SELECT * FROM documents
      WHERE deal_id = $1
        AND (
          filename ILIKE $2
          OR extracted_text ILIKE $2
        )
      ORDER BY uploaded_at DESC
      LIMIT $3
    `;

    const result = await this.db.query<Document>(query, [
      dealId,
      `%${searchTerm}%`,
      limit,
    ]);
    return result.rows;
  }

  /**
   * Get document statistics for a deal
   */
  async getStatistics(dealId: string) {
    const query = `
      SELECT
        COUNT(*) as total_count,
        SUM(file_size_bytes) as total_size_bytes,
        COUNT(CASE WHEN processing_status = 'indexed' THEN 1 END) as indexed_count,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_count,
        COUNT(DISTINCT document_type) as unique_types
      FROM documents
      WHERE deal_id = $1
    `;

    const result = await this.db.query<{
      total_count: string;
      total_size_bytes: string;
      indexed_count: string;
      failed_count: string;
      unique_types: string;
    }>(query, [dealId]);

    return {
      totalCount: parseInt(result.rows[0]?.total_count || '0'),
      totalSizeBytes: parseInt(result.rows[0]?.total_size_bytes || '0'),
      indexedCount: parseInt(result.rows[0]?.indexed_count || '0'),
      failedCount: parseInt(result.rows[0]?.failed_count || '0'),
      uniqueTypes: parseInt(result.rows[0]?.unique_types || '0'),
    };
  }

  /**
   * Delete document
   */
  async delete(documentId: string): Promise<boolean> {
    const query = 'DELETE FROM documents WHERE id = $1';
    const result = await this.db.query(query, [documentId]);
    logger.info('Document deleted', { documentId });
    return (result.rowCount || 0) > 0;
  }
}
