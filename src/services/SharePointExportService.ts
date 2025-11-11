/**
 * SharePoint Export Service
 * Exports findings and reports to Microsoft SharePoint
 */

import { DatabaseClient } from '../database/client';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { DealRepository } from '../database/repositories/DealRepository';
import { AuditService } from './AuditService';
import { logger } from '../utils/logger';

export interface SharePointExportOptions {
  deal_id: string;
  export_type: 'findings' | 'documents' | 'complete_report' | 'executive_summary';
  site_url: string;
  folder_path: string;
  include_citations: boolean;
  format: 'docx' | 'pdf' | 'html';
}

export interface ExportResult {
  success: boolean;
  file_url?: string;
  file_name?: string;
  exported_items: number;
  errors: string[];
}

export class SharePointExportService {
  private findingRepo: FindingRepository;
  private documentRepo: DocumentRepository;
  private dealRepo: DealRepository;
  private auditService: AuditService;

  constructor(private db: DatabaseClient) {
    this.findingRepo = new FindingRepository(db);
    this.documentRepo = new DocumentRepository(db);
    this.dealRepo = new DealRepository(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Export content to SharePoint
   */
  async export(
    options: SharePointExportOptions,
    userId: string
  ): Promise<ExportResult> {
    logger.info('Starting SharePoint export', {
      dealId: options.deal_id,
      exportType: options.export_type,
      format: options.format,
    });

    try {
      // Get deal information
      const deal = await this.dealRepo.findById(options.deal_id);
      if (!deal) {
        return {
          success: false,
          exported_items: 0,
          errors: ['Deal not found'],
        };
      }

      // Generate content based on export type
      let content: string;
      let fileName: string;
      let itemCount = 0;

      switch (options.export_type) {
        case 'findings':
          ({ content, itemCount } = await this.exportFindings(options.deal_id, options.include_citations));
          fileName = `${deal.name.replace(/\s+/g, '_')}_Findings`;
          break;

        case 'documents':
          ({ content, itemCount } = await this.exportDocumentList(options.deal_id));
          fileName = `${deal.name.replace(/\s+/g, '_')}_Documents`;
          break;

        case 'executive_summary':
          ({ content, itemCount } = await this.exportExecutiveSummary(options.deal_id));
          fileName = `${deal.name.replace(/\s+/g, '_')}_Executive_Summary`;
          break;

        case 'complete_report':
          ({ content, itemCount } = await this.exportCompleteReport(options.deal_id));
          fileName = `${deal.name.replace(/\s+/g, '_')}_Complete_Report`;
          break;

        default:
          return {
            success: false,
            exported_items: 0,
            errors: ['Unknown export type'],
          };
      }

      // Add timestamp to filename
      const timestamp = new Date().toISOString().split('T')[0];
      fileName = `${fileName}_${timestamp}.${options.format}`;

      // Upload to SharePoint (placeholder - would use actual SharePoint API)
      const fileUrl = await this.uploadToSharePoint(
        content,
        fileName,
        options.site_url,
        options.folder_path,
        options.format
      );

      // Log export
      await this.auditService.logDataExport(
        options.deal_id,
        userId,
        options.export_type,
        itemCount
      );

      logger.info('SharePoint export completed', {
        dealId: options.deal_id,
        fileName,
        itemCount,
      });

      return {
        success: true,
        file_url: fileUrl,
        file_name: fileName,
        exported_items: itemCount,
        errors: [],
      };
    } catch (error) {
      logger.error('SharePoint export failed', {
        dealId: options.deal_id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        exported_items: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================================
  // CONTENT GENERATION
  // ============================================================================

  /**
   * Export findings report
   * @private
   */
  private async exportFindings(
    dealId: string,
    includeCitations: boolean
  ): Promise<{ content: string; itemCount: number }> {
    const findings = await this.findingRepo.findByDeal(dealId, { limit: 1000 });

    const parts: string[] = [];
    parts.push('# Due Diligence Findings\n\n');
    parts.push(`**Total Findings:** ${findings.length}\n\n`);

    // Group by workstream
    const byWorkstream: Record<string, any[]> = {};
    for (const finding of findings) {
      const ws = finding.generated_by_agent || 'General';
      if (!byWorkstream[ws]) byWorkstream[ws] = [];
      byWorkstream[ws].push(finding);
    }

    // Export each workstream
    for (const [workstream, wsFindings] of Object.entries(byWorkstream)) {
      parts.push(`## ${workstream.toUpperCase()} (${wsFindings.length} findings)\n\n`);

      // Sort by impact and confidence
      const sorted = wsFindings.sort((a, b) => {
        const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aImpact = impactOrder[a.impact_level as keyof typeof impactOrder] ?? 4;
        const bImpact = impactOrder[b.impact_level as keyof typeof impactOrder] ?? 4;

        if (aImpact !== bImpact) return aImpact - bImpact;
        return b.confidence_score - a.confidence_score;
      });

      for (const finding of sorted) {
        parts.push(`### ${finding.title}\n\n`);
        parts.push(`**Type:** ${finding.finding_type}\n`);
        parts.push(`**Impact:** ${finding.impact_level || 'N/A'}\n`);
        parts.push(`**Confidence:** ${(finding.confidence_score * 100).toFixed(0)}%\n\n`);
        parts.push(`${finding.description}\n\n`);

        if (finding.financial_impact_usd) {
          const impact = finding.financial_impact_usd;
          const sign = impact >= 0 ? '+' : '';
          parts.push(`**Financial Impact:** ${sign}$${(Math.abs(impact) / 1000000).toFixed(2)}M\n\n`);
        }

        // Add citations if requested
        if (includeCitations) {
          const citations = await this.findingRepo.getCitations(finding.id);
          if (citations.length > 0) {
            parts.push(`**Sources:**\n`);
            for (const citation of citations) {
              const citationInfo = citation as any;
              parts.push(`- ${citationInfo.filename || 'Document'}`);
              if (citation.page_number) {
                parts.push(` (Page ${citation.page_number})`);
              }
              parts.push('\n');
            }
            parts.push('\n');
          }
        }

        parts.push('---\n\n');
      }
    }

    return {
      content: parts.join(''),
      itemCount: findings.length,
    };
  }

  /**
   * Export document list
   * @private
   */
  private async exportDocumentList(dealId: string): Promise<{ content: string; itemCount: number }> {
    const documents = await this.documentRepo.findByDeal(dealId, 1000);

    const parts: string[] = [];
    parts.push('# Document Inventory\n\n');
    parts.push(`**Total Documents:** ${documents.length}\n\n`);

    // Group by type
    const byType: Record<string, any[]> = {};
    for (const doc of documents) {
      const type = doc.document_type || 'Unclassified';
      if (!byType[type]) byType[type] = [];
      byType[type].push(doc);
    }

    // Export each type
    for (const [type, docs] of Object.entries(byType)) {
      parts.push(`## ${type} (${docs.length} documents)\n\n`);

      for (const doc of docs) {
        parts.push(`- **${doc.filename}**\n`);
        parts.push(`  - Size: ${(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB\n`);
        parts.push(`  - Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString()}\n`);
        if (doc.tags && doc.tags.length > 0) {
          parts.push(`  - Tags: ${doc.tags.join(', ')}\n`);
        }
        parts.push('\n');
      }
    }

    return {
      content: parts.join(''),
      itemCount: documents.length,
    };
  }

  /**
   * Export executive summary
   * @private
   */
  private async exportExecutiveSummary(dealId: string): Promise<{ content: string; itemCount: number }> {
    const deal = await this.dealRepo.findById(dealId);
    const summary = await this.dealRepo.getSummary(dealId);
    const findings = await this.findingRepo.findByDeal(dealId, { limit: 1000 });
    const redFlags = findings.filter((f) => f.finding_type === 'red_flag');
    const highImpact = findings.filter((f) => f.impact_level === 'critical' || f.impact_level === 'high');

    const parts: string[] = [];

    parts.push(`# Executive Summary: ${deal?.name}\n\n`);
    parts.push(`**Target Company:** ${deal?.target_company}\n`);
    parts.push(`**Deal Type:** ${deal?.deal_type}\n`);
    parts.push(`**Current Phase:** ${deal?.current_phase}\n\n`);

    parts.push('## Key Metrics\n\n');
    parts.push(`- Total Findings: ${summary?.finding_count || 0}\n`);
    parts.push(`- Red Flags: ${summary?.red_flag_count || 0}\n`);
    parts.push(`- Documents Reviewed: ${summary?.document_count || 0}\n`);
    parts.push(`- Workstream Progress: ${summary?.avg_workstream_progress?.toFixed(0) || 0}%\n\n`);

    if (redFlags.length > 0) {
      parts.push('## Critical Red Flags\n\n');
      for (const flag of redFlags.slice(0, 5)) {
        parts.push(`### ${flag.title}\n\n`);
        parts.push(`${flag.description}\n\n`);
      }
    }

    if (highImpact.length > 0) {
      parts.push('## High Impact Findings\n\n');
      for (const finding of highImpact.slice(0, 5)) {
        parts.push(`- **${finding.title}** (${finding.generated_by_agent})\n`);
      }
      parts.push('\n');
    }

    return {
      content: parts.join(''),
      itemCount: 1,
    };
  }

  /**
   * Export complete report
   * @private
   */
  private async exportCompleteReport(dealId: string): Promise<{ content: string; itemCount: number }> {
    // Combine all exports
    const { content: summary } = await this.exportExecutiveSummary(dealId);
    const { content: findings } = await this.exportFindings(dealId, true);
    const { content: documents } = await this.exportDocumentList(dealId);

    const parts: string[] = [];
    parts.push(summary);
    parts.push('\n\n---\n\n');
    parts.push(findings);
    parts.push('\n\n---\n\n');
    parts.push(documents);

    return {
      content: parts.join(''),
      itemCount: 1,
    };
  }

  // ============================================================================
  // SHAREPOINT INTEGRATION
  // ============================================================================

  /**
   * Upload content to SharePoint
   * @private
   */
  private async uploadToSharePoint(
    content: string,
    fileName: string,
    siteUrl: string,
    folderPath: string,
    format: string
  ): Promise<string> {
    // TODO: Implement actual SharePoint Graph API integration
    // This would use Microsoft Graph API to:
    // 1. Authenticate with Azure AD
    // 2. Convert content to requested format (DOCX, PDF, HTML)
    // 3. Upload to SharePoint site
    // 4. Return the file URL

    logger.info('SharePoint upload (placeholder)', {
      fileName,
      siteUrl,
      folderPath,
      format,
    });

    // Placeholder return
    return `${siteUrl}/${folderPath}/${fileName}`;
  }

  /**
   * Create folder structure in SharePoint for a deal
   */
  async createDealFolderStructure(
    dealId: string,
    siteUrl: string,
    basePath: string
  ): Promise<{ success: boolean; folders: string[] }> {
    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      return { success: false, folders: [] };
    }

    const dealFolderName = deal.name.replace(/\s+/g, '_');
    const folders = [
      `${basePath}/${dealFolderName}`,
      `${basePath}/${dealFolderName}/Documents`,
      `${basePath}/${dealFolderName}/Findings`,
      `${basePath}/${dealFolderName}/Reports`,
      `${basePath}/${dealFolderName}/Financial`,
      `${basePath}/${dealFolderName}/Commercial`,
      `${basePath}/${dealFolderName}/Technical`,
      `${basePath}/${dealFolderName}/Operational`,
    ];

    // TODO: Actually create folders in SharePoint
    logger.info('SharePoint folder structure (placeholder)', { folders });

    return {
      success: true,
      folders,
    };
  }
}
