/**
 * Perplexity MCP Server Client
 * Real-time search and research
 */

import axios, { AxiosInstance } from 'axios';
import {
  PerplexityConfig,
  PerplexitySearchParams,
  PerplexitySearchResponse,
  MCPResponse,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class PerplexityClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://api.perplexity.ai';

  constructor(private config: PerplexityConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 60000, // Perplexity can be slow
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Search with Perplexity
   */
  async search(
    params: PerplexitySearchParams
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const requestId = this.generateRequestId();

    try {
      const requestBody = {
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: params.query,
          },
        ],
        ...(params.search_domain_filter && {
          search_domain_filter: params.search_domain_filter,
        }),
        ...(params.search_recency_filter && {
          search_recency_filter: params.search_recency_filter,
        }),
        return_citations: params.return_citations ?? true,
        return_images: params.return_images ?? false,
      };

      const response = await this.client.post('/chat/completions', requestBody);

      // Parse Perplexity response
      const data: PerplexitySearchResponse = {
        answer: response.data.choices[0]?.message?.content || '',
        citations: response.data.citations || [],
        images: response.data.images || [],
        relatedQuestions: response.data.related_questions || [],
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'perplexity',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'perplexity');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'perplexity',
      };
    }
  }

  /**
   * Search for company information
   */
  async searchCompany(
    companyName: string,
    aspects?: string[]
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const aspectsStr = aspects ? ` focusing on ${aspects.join(', ')}` : '';
    const query = `Provide detailed information about ${companyName}${aspectsStr}. Include business model, market position, recent developments, and key metrics.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Search for market trends
   */
  async searchMarketTrends(
    industry: string,
    timeframe: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What are the latest trends and developments in the ${industry} industry? Include market dynamics, key players, and emerging opportunities.`;

    return this.search({
      query,
      search_recency_filter: timeframe,
      return_citations: true,
    });
  }

  /**
   * Search for competitive analysis
   */
  async searchCompetitors(
    companyName: string,
    industry: string
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `Who are the main competitors of ${companyName} in the ${industry} industry? Compare their market positions, products, and strategies.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Search for financial information
   */
  async searchFinancials(
    companyName: string
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What is the latest financial information about ${companyName}? Include revenue, profitability, growth rates, and recent financial performance.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Search for news and events
   */
  async searchNews(
    companyName: string,
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What are the latest news and significant events about ${companyName}? Include any major announcements, partnerships, or developments.`;

    return this.search({
      query,
      search_recency_filter: timeframe,
      return_citations: true,
    });
  }

  /**
   * Search for risks and challenges
   */
  async searchRisks(
    companyName: string,
    industry: string
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What are the key risks and challenges facing ${companyName} in the ${industry} industry? Include competitive, regulatory, operational, and market risks.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Search for technology and innovation
   */
  async searchTechnology(
    companyName: string
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What technologies and innovations is ${companyName} developing or using? Include R&D efforts, patents, and technical capabilities.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Search for customer and market insights
   */
  async searchCustomerInsights(
    companyName: string
  ): Promise<MCPResponse<PerplexitySearchResponse>> {
    const query = `What are the customer reviews, satisfaction levels, and market perception of ${companyName}? Include customer feedback and reputation analysis.`;

    return this.search({
      query,
      search_recency_filter: 'month',
      return_citations: true,
    });
  }

  /**
   * Comprehensive company research
   */
  async comprehensiveResearch(
    companyName: string,
    industry: string
  ): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [
        overview,
        financials,
        competitors,
        news,
        risks,
        technology,
      ] = await Promise.allSettled([
        this.searchCompany(companyName),
        this.searchFinancials(companyName),
        this.searchCompetitors(companyName, industry),
        this.searchNews(companyName),
        this.searchRisks(companyName, industry),
        this.searchTechnology(companyName),
      ]);

      const data = {
        overview: overview.status === 'fulfilled' ? overview.value.data : null,
        financials: financials.status === 'fulfilled' ? financials.value.data : null,
        competitors: competitors.status === 'fulfilled' ? competitors.value.data : null,
        news: news.status === 'fulfilled' ? news.value.data : null,
        risks: risks.status === 'fulfilled' ? risks.value.data : null,
        technology: technology.status === 'fulfilled' ? technology.value.data : null,
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'perplexity',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'perplexity');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'perplexity',
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `perplexity_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.search({
        query: 'test',
      });

      return result.success;
    } catch (error) {
      return false;
    }
  }
}
