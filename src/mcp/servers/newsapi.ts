/**
 * NewsAPI MCP Server Client
 * News monitoring and sentiment analysis
 */

import axios, { AxiosInstance } from 'axios';
import {
  NewsAPIConfig,
  NewsAPISearchParams,
  NewsAPIArticle,
  NewsAPIResponse,
  MCPResponse,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class NewsAPIClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://newsapi.org/v2';

  constructor(private config: NewsAPIConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'X-Api-Key': config.apiKey,
      },
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Search everything endpoint
   */
  async searchEverything(
    params: NewsAPISearchParams
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('/everything', {
        params: {
          q: params.q,
          sources: params.sources,
          domains: params.domains,
          from: params.from,
          to: params.to,
          language: params.language || 'en',
          sortBy: params.sortBy || 'publishedAt',
          pageSize: params.pageSize || 20,
          page: params.page || 1,
        },
      });

      if (response.data.status !== 'ok') {
        throw new Error(response.data.message || 'NewsAPI request failed');
      }

      return {
        success: true,
        data: response.data as NewsAPIResponse,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'newsapi');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    }
  }

  /**
   * Get top headlines
   */
  async getTopHeadlines(params: {
    q?: string;
    country?: string;
    category?: string;
    sources?: string;
    pageSize?: number;
    page?: number;
  }): Promise<MCPResponse<NewsAPIResponse>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('/top-headlines', {
        params: {
          q: params.q,
          country: params.country,
          category: params.category,
          sources: params.sources,
          pageSize: params.pageSize || 20,
          page: params.page || 1,
        },
      });

      if (response.data.status !== 'ok') {
        throw new Error(response.data.message || 'NewsAPI request failed');
      }

      return {
        success: true,
        data: response.data as NewsAPIResponse,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'newsapi');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    }
  }

  /**
   * Search news about a company
   */
  async searchCompanyNews(
    companyName: string,
    options?: {
      daysBack?: number;
      pageSize?: number;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    }
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const daysBack = options?.daysBack || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const params: NewsAPISearchParams = {
      q: companyName,
      from: fromDate.toISOString().split('T')[0],
      sortBy: options?.sortBy || 'publishedAt',
      pageSize: options?.pageSize || 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Search industry news
   */
  async searchIndustryNews(
    industry: string,
    options?: {
      daysBack?: number;
      pageSize?: number;
    }
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const daysBack = options?.daysBack || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const params: NewsAPISearchParams = {
      q: industry,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      pageSize: options?.pageSize || 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Search for specific topics about a company
   */
  async searchCompanyTopics(
    companyName: string,
    topics: string[],
    options?: {
      daysBack?: number;
      pageSize?: number;
    }
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const daysBack = options?.daysBack || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // Build query with topics
    const query = `"${companyName}" AND (${topics.join(' OR ')})`;

    const params: NewsAPISearchParams = {
      q: query,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      pageSize: options?.pageSize || 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Monitor for negative news
   */
  async searchNegativeNews(
    companyName: string,
    daysBack: number = 7
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const negativeKeywords = [
      'lawsuit',
      'scandal',
      'fraud',
      'investigation',
      'controversy',
      'crisis',
      'layoff',
      'bankruptcy',
      'fine',
      'penalty',
    ];

    const query = `"${companyName}" AND (${negativeKeywords.join(' OR ')})`;

    const params: NewsAPISearchParams = {
      q: query,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'relevancy',
      pageSize: 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Search for positive news
   */
  async searchPositiveNews(
    companyName: string,
    daysBack: number = 7
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const positiveKeywords = [
      'growth',
      'success',
      'innovation',
      'partnership',
      'expansion',
      'award',
      'achievement',
      'milestone',
      'breakthrough',
      'acquisition',
    ];

    const query = `"${companyName}" AND (${positiveKeywords.join(' OR ')})`;

    const params: NewsAPISearchParams = {
      q: query,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'relevancy',
      pageSize: 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Get comprehensive news analysis
   */
  async getComprehensiveNews(companyName: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [recentNews, negativeNews, positiveNews] = await Promise.allSettled([
        this.searchCompanyNews(companyName, { daysBack: 30 }),
        this.searchNegativeNews(companyName, 30),
        this.searchPositiveNews(companyName, 30),
      ]);

      const data = {
        recentNews: recentNews.status === 'fulfilled' ? recentNews.value.data : null,
        negativeNews:
          negativeNews.status === 'fulfilled' ? negativeNews.value.data : null,
        positiveNews:
          positiveNews.status === 'fulfilled' ? positiveNews.value.data : null,
        summary: {
          totalArticles:
            (recentNews.status === 'fulfilled'
              ? recentNews.value.data?.totalResults || 0
              : 0),
          negativeArticles:
            (negativeNews.status === 'fulfilled'
              ? negativeNews.value.data?.totalResults || 0
              : 0),
          positiveArticles:
            (positiveNews.status === 'fulfilled'
              ? positiveNews.value.data?.totalResults || 0
              : 0),
        },
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'newsapi');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'newsapi',
      };
    }
  }

  /**
   * Search for M&A news
   */
  async searchMAndANews(
    companyName: string,
    daysBack: number = 90
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const query = `"${companyName}" AND (acquisition OR merger OR "M&A" OR "acquires" OR "acquired")`;

    const params: NewsAPISearchParams = {
      q: query,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      pageSize: 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Search for leadership changes
   */
  async searchLeadershipNews(
    companyName: string,
    daysBack: number = 90
  ): Promise<MCPResponse<NewsAPIResponse>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const query = `"${companyName}" AND (CEO OR CFO OR CTO OR "executive" OR "leadership" OR "appointed" OR "resignation")`;

    const params: NewsAPISearchParams = {
      q: query,
      from: fromDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      pageSize: 50,
      language: 'en',
    };

    return this.searchEverything(params);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `newsapi_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.getTopHeadlines({
        pageSize: 1,
      });

      return result.success;
    } catch (error) {
      return false;
    }
  }
}
