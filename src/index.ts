/**
 * Diligence Cubed - Agentic Due Diligence Platform
 * Main entry point for the platform
 */

import { DiligencePlatform } from './orchestration/DiligencePlatform';
import { DiligenceConfig, DiligenceScope, DiligenceDepth } from './types/diligence';
import { logger } from './utils/logger';

/**
 * Main platform interface for initiating due diligence research
 */
export class DiligenceCubed {
  private platform: DiligencePlatform;

  constructor(config?: Partial<DiligenceConfig>) {
    this.platform = new DiligencePlatform(config);
    logger.info('DiligenceCubed platform initialized');
  }

  /**
   * Initiate a new due diligence research project
   * @param companyName - Name of the target company
   * @param options - Configuration options for the diligence
   * @returns Promise resolving to diligence ID
   */
  async startDiligence(
    companyName: string,
    options: {
      companyDomain?: string;
      scope?: DiligenceScope;
      depth?: DiligenceDepth;
      priority?: 'normal' | 'high' | 'critical';
      webhookUrl?: string;
    } = {}
  ): Promise<string> {
    logger.info(`Starting diligence for company: ${companyName}`, { options });

    try {
      const diligenceId = await this.platform.initiateDiligence({
        companyName,
        companyDomain: options.companyDomain || '',
        scope: options.scope || 'full',
        depth: options.depth || 'standard',
        priority: options.priority || 'normal',
        webhookUrl: options.webhookUrl,
      });

      logger.info(`Diligence initiated successfully`, { diligenceId });
      return diligenceId;
    } catch (error) {
      logger.error('Failed to start diligence', { error, companyName });
      throw error;
    }
  }

  /**
   * Get the current status of a diligence project
   * @param diligenceId - Unique identifier for the diligence
   * @returns Promise resolving to status information
   */
  async getStatus(diligenceId: string): Promise<{
    diligenceId: string;
    status: 'initiated' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    currentStage: string;
    agentsActive: string[];
  }> {
    logger.info(`Fetching status for diligence: ${diligenceId}`);
    return this.platform.getStatus(diligenceId);
  }

  /**
   * Get the results of a completed diligence
   * @param diligenceId - Unique identifier for the diligence
   * @param format - Output format (json, pdf, excel)
   * @returns Promise resolving to the diligence report
   */
  async getResults(
    diligenceId: string,
    format: 'json' | 'pdf' | 'excel' = 'json'
  ): Promise<unknown> {
    logger.info(`Fetching results for diligence: ${diligenceId}`, { format });
    return this.platform.getResults(diligenceId, format);
  }

  /**
   * Stop the platform and cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down DiligenceCubed platform');
    await this.platform.shutdown();
  }
}

// Export type definitions
export * from './types/diligence';
export * from './types/agents';
export * from './types/mcp';

// Export main platform class as default
export default DiligenceCubed;
