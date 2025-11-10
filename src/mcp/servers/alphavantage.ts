/**
 * AlphaVantage MCP Server Client
 * Financial data and market fundamentals
 */

import axios, { AxiosInstance } from 'axios';
import {
  AlphaVantageConfig,
  AlphaVantageTimeSeriesParams,
  AlphaVantageFundamentalsParams,
  AlphaVantageOverview,
  MCPResponse,
  MCPErrorType,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class AlphaVantageClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://www.alphavantage.co/query';

  constructor(private config: AlphaVantageConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Get company overview and fundamentals
   */
  async getCompanyOverview(symbol: string): Promise<MCPResponse<AlphaVantageOverview>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: this.config.apiKey,
        },
      });

      // Check for API error
      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        // Rate limit message
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60; // AlphaVantage typically needs 60s wait
        throw error;
      }

      return {
        success: true,
        data: response.data as AlphaVantageOverview,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get income statement
   */
  async getIncomeStatement(symbol: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: 'INCOME_STATEMENT',
          symbol,
          apikey: this.config.apiKey,
        },
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60;
        throw error;
      }

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get balance sheet
   */
  async getBalanceSheet(symbol: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: 'BALANCE_SHEET',
          symbol,
          apikey: this.config.apiKey,
        },
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60;
        throw error;
      }

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get cash flow statement
   */
  async getCashFlow(symbol: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: 'CASH_FLOW',
          symbol,
          apikey: this.config.apiKey,
        },
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60;
        throw error;
      }

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get earnings data
   */
  async getEarnings(symbol: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: 'EARNINGS',
          symbol,
          apikey: this.config.apiKey,
        },
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60;
        throw error;
      }

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeries(params: AlphaVantageTimeSeriesParams): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get('', {
        params: {
          function: params.function,
          symbol: params.symbol,
          outputsize: params.outputsize || 'compact',
          apikey: this.config.apiKey,
        },
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        const error = this.errorHandler.createError(
          new Error('Rate limit reached'),
          'alphavantage'
        );
        error.type = MCPErrorType.RATE_LIMIT;
        error.retryAfter = 60;
        throw error;
      }

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Get complete financial package for a company
   */
  async getFinancialPackage(symbol: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [overview, income, balance, cashFlow, earnings] = await Promise.allSettled([
        this.getCompanyOverview(symbol),
        this.getIncomeStatement(symbol),
        this.getBalanceSheet(symbol),
        this.getCashFlow(symbol),
        this.getEarnings(symbol),
      ]);

      const data = {
        overview: overview.status === 'fulfilled' ? overview.value.data : null,
        incomeStatement: income.status === 'fulfilled' ? income.value.data : null,
        balanceSheet: balance.status === 'fulfilled' ? balance.value.data : null,
        cashFlow: cashFlow.status === 'fulfilled' ? cashFlow.value.data : null,
        earnings: earnings.status === 'fulfilled' ? earnings.value.data : null,
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'alphavantage');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'alphavantage',
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `av_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple API call
      const response = await this.client.get('', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: 'MSFT',
          apikey: this.config.apiKey,
        },
        timeout: 5000,
      });

      return !response.data['Error Message'] && !response.data['Note'];
    } catch (error) {
      return false;
    }
  }
}
