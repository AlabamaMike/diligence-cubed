/**
 * Polygon.io MCP Server Client
 * Real-time market data and financial information
 */

import axios, { AxiosInstance } from 'axios';
import {
  PolygonConfig,
  PolygonTickerParams,
  PolygonAggregatesParams,
  PolygonAggregate,
  PolygonTickerDetails,
  MCPResponse,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class PolygonClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://api.polygon.io';

  constructor(private config: PolygonConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      params: {
        apiKey: config.apiKey,
      },
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Get ticker details
   */
  async getTickerDetails(
    ticker: string
  ): Promise<MCPResponse<PolygonTickerDetails>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/v3/reference/tickers/${ticker}`);

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results as PolygonTickerDetails,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get aggregates (bars) for a ticker
   */
  async getAggregates(
    params: PolygonAggregatesParams
  ): Promise<MCPResponse<PolygonAggregate[]>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(
        `/v2/aggs/ticker/${params.ticker}/range/${params.multiplier}/${params.timespan}/${params.from}/${params.to}`,
        {
          params: {
            adjusted: params.adjusted ?? true,
            sort: params.sort || 'asc',
            limit: params.limit || 5000,
          },
        }
      );

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results as PolygonAggregate[],
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get previous day's OHLC for a ticker
   */
  async getPreviousClose(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/v2/aggs/ticker/${ticker}/prev`);

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results?.[0],
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get snapshot for a ticker
   */
  async getSnapshot(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.ticker,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get daily price data for the last N days
   */
  async getDailyPrices(
    ticker: string,
    daysBack: number = 90
  ): Promise<MCPResponse<PolygonAggregate[]>> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const params: PolygonAggregatesParams = {
      ticker,
      multiplier: 1,
      timespan: 'day',
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      adjusted: true,
      sort: 'asc',
    };

    return this.getAggregates(params);
  }

  /**
   * Get weekly price data
   */
  async getWeeklyPrices(
    ticker: string,
    weeksBack: number = 52
  ): Promise<MCPResponse<PolygonAggregate[]>> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - weeksBack * 7);

    const params: PolygonAggregatesParams = {
      ticker,
      multiplier: 1,
      timespan: 'week',
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      adjusted: true,
      sort: 'asc',
    };

    return this.getAggregates(params);
  }

  /**
   * Get monthly price data
   */
  async getMonthlyPrices(
    ticker: string,
    monthsBack: number = 24
  ): Promise<MCPResponse<PolygonAggregate[]>> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);

    const params: PolygonAggregatesParams = {
      ticker,
      multiplier: 1,
      timespan: 'month',
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      adjusted: true,
      sort: 'asc',
    };

    return this.getAggregates(params);
  }

  /**
   * Get financial information for a ticker
   */
  async getFinancials(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/vX/reference/financials`, {
        params: {
          ticker,
          limit: 10,
        },
      });

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get stock splits
   */
  async getStockSplits(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/v3/reference/splits`, {
        params: {
          ticker,
          limit: 100,
        },
      });

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get dividends
   */
  async getDividends(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/v3/reference/dividends`, {
        params: {
          ticker,
          limit: 100,
        },
      });

      if (response.data.status === 'ERROR') {
        throw new Error(response.data.error || 'Polygon API error');
      }

      return {
        success: true,
        data: response.data.results,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Get comprehensive market data package
   */
  async getMarketDataPackage(ticker: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [
        details,
        snapshot,
        dailyPrices,
        financials,
        splits,
        dividends,
      ] = await Promise.allSettled([
        this.getTickerDetails(ticker),
        this.getSnapshot(ticker),
        this.getDailyPrices(ticker, 90),
        this.getFinancials(ticker),
        this.getStockSplits(ticker),
        this.getDividends(ticker),
      ]);

      const data = {
        details: details.status === 'fulfilled' ? details.value.data : null,
        snapshot: snapshot.status === 'fulfilled' ? snapshot.value.data : null,
        dailyPrices:
          dailyPrices.status === 'fulfilled' ? dailyPrices.value.data : null,
        financials: financials.status === 'fulfilled' ? financials.value.data : null,
        splits: splits.status === 'fulfilled' ? splits.value.data : null,
        dividends: dividends.status === 'fulfilled' ? dividends.value.data : null,
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Calculate price metrics
   */
  async getPriceMetrics(ticker: string, daysBack: number = 90): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const priceData = await this.getDailyPrices(ticker, daysBack);

      if (!priceData.success || !priceData.data) {
        throw new Error('Failed to fetch price data');
      }

      const prices = priceData.data;
      if (prices.length === 0) {
        throw new Error('No price data available');
      }

      // Calculate metrics
      const currentPrice = prices[prices.length - 1].c;
      const startPrice = prices[0].c;
      const highPrice = Math.max(...prices.map((p) => p.h));
      const lowPrice = Math.min(...prices.map((p) => p.l));

      const priceChange = currentPrice - startPrice;
      const priceChangePercent = (priceChange / startPrice) * 100;

      const avgVolume =
        prices.reduce((sum, p) => sum + p.v, 0) / prices.length;

      // Calculate volatility (standard deviation of returns)
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        const dailyReturn = (prices[i].c - prices[i - 1].c) / prices[i - 1].c;
        returns.push(dailyReturn);
      }
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance =
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        returns.length;
      const volatility = Math.sqrt(variance) * 100; // Annualized

      const metrics = {
        currentPrice,
        priceChange,
        priceChangePercent,
        highPrice,
        lowPrice,
        avgVolume,
        volatility,
        periodDays: prices.length,
      };

      return {
        success: true,
        data: metrics,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'polygon');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'polygon',
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `polygon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple ticker lookup
      const result = await this.getTickerDetails('AAPL');
      return result.success;
    } catch (error) {
      return false;
    }
  }
}
