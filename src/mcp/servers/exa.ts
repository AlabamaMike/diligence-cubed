/**
 * Exa.ai MCP Server Client
 * Deep web search and research
 */

import axios, { AxiosInstance } from 'axios';
import {
  ExaConfig,
  ExaSearchParams,
  ExaSearchResponse,
  MCPResponse,
  MCPErrorType,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class ExaClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://api.exa.ai';

  constructor(private config: ExaConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Search with Exa
   */
  async search(params: ExaSearchParams): Promise<MCPResponse<ExaSearchResponse>> {
    const requestId = this.generateRequestId();

    try {
      const requestBody = {
        query: params.query,
        num_results: params.numResults || 10,
        ...(params.includeDomains && { include_domains: params.includeDomains }),
        ...(params.excludeDomains && { exclude_domains: params.excludeDomains }),
        ...(params.startPublishedDate && {
          start_published_date: params.startPublishedDate,
        }),
        ...(params.endPublishedDate && {
          end_published_date: params.endPublishedDate,
        }),
        ...(params.useAutoprompt !== undefined && {
          use_autoprompt: params.useAutoprompt,
        }),
        ...(params.type && { type: params.type }),
        ...(params.contents && { contents: params.contents }),
      };

      const response = await this.client.post('/search', requestBody);

      return {
        success: true,
        data: response.data as ExaSearchResponse,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'exa');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    }
  }

  /**
   * Find similar content
   */
  async findSimilar(url: string, numResults: number = 10): Promise<MCPResponse<ExaSearchResponse>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.post('/findSimilar', {
        url,
        num_results: numResults,
      });

      return {
        success: true,
        data: response.data as ExaSearchResponse,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'exa');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    }
  }

  /**
   * Get contents for URLs
   */
  async getContents(
    ids: string[],
    options?: {
      text?: boolean;
      highlights?: boolean;
      summary?: boolean;
    }
  ): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.post('/contents', {
        ids,
        ...(options && { contents: options }),
      });

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'exa');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    }
  }

  /**
   * Search for company information
   */
  async searchCompany(
    companyName: string,
    options?: {
      includeFinancials?: boolean;
      includeNews?: boolean;
      numResults?: number;
    }
  ): Promise<MCPResponse<ExaSearchResponse>> {
    const requestId = this.generateRequestId();

    try {
      const queries: ExaSearchParams[] = [];

      // Main company search
      queries.push({
        query: `${companyName} company overview business model`,
        numResults: options?.numResults || 5,
        useAutoprompt: true,
        contents: {
          text: true,
          highlights: true,
          summary: true,
        },
      });

      // Financial information if requested
      if (options?.includeFinancials) {
        queries.push({
          query: `${companyName} financials revenue earnings`,
          numResults: 3,
          useAutoprompt: true,
          contents: {
            text: true,
            highlights: true,
          },
        });
      }

      // News if requested
      if (options?.includeNews) {
        queries.push({
          query: `${companyName} news latest`,
          numResults: 5,
          useAutoprompt: true,
          startPublishedDate: this.getDateDaysAgo(30),
          contents: {
            text: true,
            summary: true,
          },
        });
      }

      // Execute searches in parallel
      const results = await Promise.all(queries.map((q) => this.search(q)));

      // Combine results
      const combinedResults: ExaSearchResponse = {
        results: [],
        autopromptString: results[0].data?.autopromptString,
      };

      results.forEach((result) => {
        if (result.success && result.data) {
          combinedResults.results.push(...result.data.results);
        }
      });

      return {
        success: true,
        data: combinedResults,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'exa');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'exa',
      };
    }
  }

  /**
   * Search for competitive intelligence
   */
  async searchCompetitors(
    companyName: string,
    industry: string,
    numResults: number = 10
  ): Promise<MCPResponse<ExaSearchResponse>> {
    const params: ExaSearchParams = {
      query: `competitors of ${companyName} in ${industry} industry comparison`,
      numResults,
      useAutoprompt: true,
      contents: {
        text: true,
        highlights: true,
        summary: true,
      },
    };

    return this.search(params);
  }

  /**
   * Search for market research
   */
  async searchMarketResearch(
    industry: string,
    topics: string[],
    numResults: number = 10
  ): Promise<MCPResponse<ExaSearchResponse>> {
    const topicsStr = topics.join(' ');
    const params: ExaSearchParams = {
      query: `${industry} market research ${topicsStr} trends analysis`,
      numResults,
      useAutoprompt: true,
      type: 'neural',
      contents: {
        text: true,
        highlights: true,
        summary: true,
      },
    };

    return this.search(params);
  }

  /**
   * Helper: Get date N days ago in ISO format
   */
  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `exa_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple search
      const result = await this.search({
        query: 'test',
        numResults: 1,
      });

      return result.success;
    } catch (error) {
      return false;
    }
  }
}
