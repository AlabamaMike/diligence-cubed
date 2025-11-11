/**
 * Ingestion Agent
 * Processes VDR uploads, classifies documents, maintains version control,
 * and builds searchable document room
 */

import { DatabaseClient } from '../database/client';
import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { AuditService } from '../services/AuditService';
import { NotificationService } from '../services/NotificationService';
import { Document, ProcessingStatus } from '../types/database';
import { logger } from '../utils/logger';

export interface DocumentClassification {
  document_type: string;
  confidence: number;
  suggested_workstream: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface DocumentProcessingResult {
  document: Document;
  classification: DocumentClassification;
  extracted_text_length: number;
  processing_time_ms: number;
  warnings: string[];
}

export interface BulkUploadResult {
  total_files: number;
  successful: number;
  failed: number;
  documents: Document[];
  errors: Array<{ filename: string; error: string }>;
}

export class IngestionAgent {
  private documentRepo: DocumentRepository;
  private auditService: AuditService;
  private notificationService: NotificationService;

  // Document type patterns for classification
  private readonly documentTypePatterns: Record<
    string,
    { keywords: string[]; extensions: string[]; workstream: string }
  > = {
    financial_statement: {
      keywords: [
        'balance sheet',
        'income statement',
        'cash flow',
        'p&l',
        'profit and loss',
        'financial statements',
        'audit report',
        'gaap',
        'ifrs',
      ],
      extensions: ['.xlsx', '.xls', '.pdf'],
      workstream: 'financial',
    },
    tax_return: {
      keywords: ['tax return', 'form 1120', 'schedule k-1', 'tax filing', 'irs'],
      extensions: ['.pdf'],
      workstream: 'financial',
    },
    contract: {
      keywords: [
        'agreement',
        'contract',
        'terms and conditions',
        'msa',
        'master service agreement',
        'sow',
        'statement of work',
      ],
      extensions: ['.pdf', '.docx', '.doc'],
      workstream: 'commercial',
    },
    customer_list: {
      keywords: ['customer list', 'client roster', 'customer data', 'crm export'],
      extensions: ['.xlsx', '.xls', '.csv'],
      workstream: 'commercial',
    },
    pitch_deck: {
      keywords: ['pitch deck', 'investor presentation', 'company overview', 'executive summary'],
      extensions: ['.pptx', '.ppt', '.pdf'],
      workstream: 'commercial',
    },
    technical_documentation: {
      keywords: [
        'architecture',
        'system design',
        'technical spec',
        'api documentation',
        'database schema',
      ],
      extensions: ['.md', '.pdf', '.docx'],
      workstream: 'technical',
    },
    source_code: {
      keywords: [],
      extensions: ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp'],
      workstream: 'technical',
    },
    org_chart: {
      keywords: ['org chart', 'organizational structure', 'organization chart', 'headcount'],
      extensions: ['.pdf', '.xlsx', '.pptx'],
      workstream: 'operational',
    },
    employee_handbook: {
      keywords: ['employee handbook', 'hr policies', 'compensation plan', 'benefits'],
      extensions: ['.pdf', '.docx'],
      workstream: 'operational',
    },
    supplier_contract: {
      keywords: ['supplier', 'vendor agreement', 'procurement', 'purchase order'],
      extensions: ['.pdf', '.docx'],
      workstream: 'operational',
    },
  };

  constructor(private db: DatabaseClient) {
    this.documentRepo = new DocumentRepository(db);
    this.auditService = new AuditService(db);
    this.notificationService = new NotificationService(db);
  }

  // ============================================================================
  // DOCUMENT UPLOAD & PROCESSING
  // ============================================================================

  /**
   * Process a single uploaded document
   */
  async processDocument(
    dealId: string,
    filename: string,
    storagePath: string,
    fileSizeBytes: number,
    mimeType: string,
    uploadedBy: string,
    fileContent?: Buffer
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    logger.info('Processing document', { dealId, filename });

    try {
      // Create document record
      const document = await this.documentRepo.create({
        deal_id: dealId,
        filename,
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes,
        mime_type: mimeType,
        uploaded_by: uploadedBy,
      });

      // Classify document
      await this.documentRepo.updateProcessingStatus(document.id, 'classifying');
      const classification = await this.classifyDocument(filename, mimeType, fileContent);

      await this.documentRepo.update(document.id, {
        document_type: classification.document_type,
        classification_confidence: classification.confidence,
        tags: classification.tags,
      });

      // Assign to workstream if possible
      if (classification.suggested_workstream) {
        const workstream = await this.findWorkstreamByType(
          dealId,
          classification.suggested_workstream
        );
        if (workstream) {
          await this.db.query('UPDATE documents SET workstream_id = $1 WHERE id = $2', [
            workstream.id,
            document.id,
          ]);
        }
      }

      // Extract text
      await this.documentRepo.updateProcessingStatus(document.id, 'extracting');
      let extractedText = '';
      let pageCount = 0;

      if (fileContent) {
        const extraction = await this.extractText(fileContent, mimeType);
        extractedText = extraction.text;
        pageCount = extraction.page_count;

        if (extraction.warnings.length > 0) {
          warnings.push(...extraction.warnings);
        }

        await this.documentRepo.update(document.id, {
          extracted_text: extractedText,
          extracted_text_status: 'completed',
          page_count: pageCount,
        });
      }

      // Mark as indexed
      await this.documentRepo.markAsIndexed(document.id);

      // Log audit trail
      await this.auditService.logDocumentUpload(
        dealId,
        uploadedBy,
        document.id,
        filename
      );

      // Notify user
      await this.notificationService.notifyDocumentProcessed(
        dealId,
        uploadedBy,
        document.id,
        filename
      );

      const processingTime = Date.now() - startTime;

      logger.info('Document processed successfully', {
        documentId: document.id,
        filename,
        type: classification.document_type,
        processingTimeMs: processingTime,
      });

      return {
        document: await this.documentRepo.findById(document.id) as Document,
        classification,
        extracted_text_length: extractedText.length,
        processing_time_ms: processingTime,
        warnings,
      };
    } catch (error) {
      logger.error('Document processing failed', {
        dealId,
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process bulk document upload
   */
  async processBulkUpload(
    dealId: string,
    files: Array<{
      filename: string;
      storagePath: string;
      fileSizeBytes: number;
      mimeType: string;
      content?: Buffer;
    }>,
    uploadedBy: string
  ): Promise<BulkUploadResult> {
    logger.info('Processing bulk upload', { dealId, fileCount: files.length });

    const result: BulkUploadResult = {
      total_files: files.length,
      successful: 0,
      failed: 0,
      documents: [],
      errors: [],
    };

    for (const file of files) {
      try {
        const processResult = await this.processDocument(
          dealId,
          file.filename,
          file.storagePath,
          file.fileSizeBytes,
          file.mimeType,
          uploadedBy,
          file.content
        );

        result.documents.push(processResult.document);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          filename: file.filename,
          error: error instanceof Error ? error.message : String(error),
        });
        logger.error('Failed to process file in bulk upload', {
          filename: file.filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Bulk upload completed', {
      dealId,
      successful: result.successful,
      failed: result.failed,
    });

    return result;
  }

  // ============================================================================
  // DOCUMENT CLASSIFICATION
  // ============================================================================

  /**
   * Classify document based on filename and content
   */
  async classifyDocument(
    filename: string,
    mimeType: string,
    content?: Buffer
  ): Promise<DocumentClassification> {
    const filenameLower = filename.toLowerCase();
    const extension = this.getFileExtension(filename);

    let bestMatch: { type: string; confidence: number; workstream: string } = {
      type: 'general_document',
      confidence: 0.3,
      workstream: 'general',
    };

    // Check patterns
    for (const [docType, pattern] of Object.entries(this.documentTypePatterns)) {
      let confidence = 0;

      // Check extension match
      if (pattern.extensions.includes(extension)) {
        confidence += 0.3;
      }

      // Check keyword match in filename
      const keywordMatches = pattern.keywords.filter((keyword) =>
        filenameLower.includes(keyword.toLowerCase())
      );

      if (keywordMatches.length > 0) {
        confidence += 0.4 + keywordMatches.length * 0.1;
      }

      // Update best match
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          type: docType,
          confidence: Math.min(confidence, 1.0),
          workstream: pattern.workstream,
        };
      }
    }

    // Extract tags
    const tags = this.extractTags(filename, bestMatch.type);

    logger.debug('Document classified', {
      filename,
      type: bestMatch.type,
      confidence: bestMatch.confidence,
    });

    return {
      document_type: bestMatch.type,
      confidence: bestMatch.confidence,
      suggested_workstream: bestMatch.workstream,
      tags,
      metadata: {
        mime_type: mimeType,
        extension,
        filename,
      },
    };
  }

  /**
   * Extract tags from filename and type
   * @private
   */
  private extractTags(filename: string, documentType: string): string[] {
    const tags: string[] = [documentType];

    const filenameLower = filename.toLowerCase();

    // Year detection
    const yearMatch = filename.match(/20\d{2}/);
    if (yearMatch) {
      tags.push(`year_${yearMatch[0]}`);
    }

    // Quarter detection
    if (/q[1-4]/i.test(filename)) {
      const quarterMatch = filename.match(/q([1-4])/i);
      if (quarterMatch) {
        tags.push(`q${quarterMatch[1]}`);
      }
    }

    // Common qualifiers
    const qualifiers = ['draft', 'final', 'revised', 'confidential', 'internal'];
    qualifiers.forEach((qualifier) => {
      if (filenameLower.includes(qualifier)) {
        tags.push(qualifier);
      }
    });

    return tags;
  }

  /**
   * Get file extension
   * @private
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
  }

  // ============================================================================
  // TEXT EXTRACTION
  // ============================================================================

  /**
   * Extract text from document
   */
  async extractText(
    content: Buffer,
    mimeType: string
  ): Promise<{
    text: string;
    page_count: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // In a real implementation, this would use appropriate libraries:
    // - pdf-parse for PDFs
    // - mammoth for DOCX
    // - xlsx for spreadsheets
    // - OCR services for images

    // Simplified implementation
    try {
      if (mimeType === 'application/pdf') {
        // TODO: Implement PDF extraction with pdf-parse
        warnings.push('PDF extraction not yet implemented');
        return {
          text: '',
          page_count: 0,
          warnings,
        };
      } else if (mimeType.includes('text') || mimeType.includes('json')) {
        // Plain text files
        return {
          text: content.toString('utf-8'),
          page_count: 1,
          warnings,
        };
      } else {
        warnings.push(`Unsupported mime type for text extraction: ${mimeType}`);
        return {
          text: '',
          page_count: 0,
          warnings,
        };
      }
    } catch (error) {
      warnings.push(`Text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        text: '',
        page_count: 0,
        warnings,
      };
    }
  }

  // ============================================================================
  // DOCUMENT MANAGEMENT
  // ============================================================================

  /**
   * Check for missing critical documents
   */
  async identifyMissingDocuments(
    dealId: string
  ): Promise<Array<{ document_type: string; importance: string; reason: string }>> {
    const existing = await this.documentRepo.findByDeal(dealId, 1000);
    const existingTypes = new Set(existing.map((d) => d.document_type));

    const critical = [
      {
        type: 'financial_statement',
        importance: 'critical',
        reason: 'Required for financial analysis',
      },
      { type: 'customer_list', importance: 'high', reason: 'Needed for customer concentration analysis' },
      { type: 'pitch_deck', importance: 'medium', reason: 'Useful for company overview' },
      { type: 'org_chart', importance: 'medium', reason: 'Needed for organizational analysis' },
    ];

    return critical
      .filter((doc) => !existingTypes.has(doc.type))
      .map((doc) => ({
        document_type: doc.type,
        importance: doc.importance,
        reason: doc.reason,
      }));
  }

  /**
   * Get document processing statistics
   */
  async getProcessingStatistics(dealId: string) {
    return this.documentRepo.getStatistics(dealId);
  }

  /**
   * Reprocess failed documents
   */
  async reprocessFailedDocuments(dealId: string): Promise<number> {
    const failedDocs = await this.db.query(
      `SELECT * FROM documents WHERE deal_id = $1 AND processing_status = 'failed'`,
      [dealId]
    );

    let reprocessedCount = 0;

    for (const doc of failedDocs.rows) {
      try {
        await this.documentRepo.updateProcessingStatus(doc.id, 'uploaded');
        // Trigger reprocessing (would need actual file content)
        reprocessedCount++;
      } catch (error) {
        logger.error('Failed to reprocess document', {
          documentId: doc.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return reprocessedCount;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Find workstream by agent type
   * @private
   */
  private async findWorkstreamByType(
    dealId: string,
    agentType: string
  ): Promise<{ id: string } | null> {
    const result = await this.db.query(
      `SELECT id FROM workstreams WHERE deal_id = $1 AND agent_type = $2 LIMIT 1`,
      [dealId, agentType]
    );

    return result.rows[0] || null;
  }
}
