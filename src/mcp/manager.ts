/**
 * MCP Server Manager
 * Central manager for all MCP server integrations
 */

import {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPManagerConfig,
  MCPManagerStats,
  ServerState,
  MCPErrorType,
} from '../types/mcp';
import { MCPCache } from './cache';
import { RateLimiter } from './rate-limiter';
import { MCPErrorHandler } from './error-handler';

// Import all server clients
import { AlphaVantageClient } from './servers/alphavantage';
import { ExaClient } from './servers/exa';
import { PerplexityClient } from './servers/perplexity';
import { GitHubClient } from './servers/github';
import { NewsAPIClient } from './servers/newsapi';
import { PolygonClient } from './servers/polygon';

type ServerClient =
  | AlphaVantageClient
  | ExaClient
  | PerplexityClient
  | GitHubClient
  | NewsAPIClient
  | PolygonClient;

export class MCPServerManager {
  private cache: MCPCache;
  private rateLimiter: RateLimiter;
  private errorHandler: MCPErrorHandler;
  private clients: Map<string, ServerClient> = new Map();
  private serverStates: Map<string, ServerState> = new Map();
  private stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    totalResponseTime: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalResponseTime: 0,
  };

  constructor(private config: MCPManagerConfig) {
    // Initialize cache
    this.cache = new MCPCache(
      config.redisUrl,
      config.defaultCacheTTL || 3600
    );

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter();

    // Initialize error handler
    this.errorHandler = new MCPErrorHandler();

    // Initialize servers
    this.initializeServers();
  }

  /**
   * Initialize all MCP server clients
   */
  private initializeServers(): void {
    Object.entries(this.config.servers).forEach(([name, config]) => {
      // Register rate limiter
      this.rateLimiter.register(name, config.rateLimit);

      // Register fallbacks
      if (config.fallbackServers) {
        this.errorHandler.registerFallback(name, config.fallbackServers);
      }

      // Create client based on server type
      let client: ServerClient | null = null;

      switch (name) {
        case 'alphavantage':
          client = new AlphaVantageClient(config as any);
          break;
        case 'exa':
          client = new ExaClient(config as any);
          break;
        case 'perplexity':
          client = new PerplexityClient(config as any);
          break;
        case 'github':
          client = new GitHubClient(config as any);
          break;
        case 'newsapi':
          client = new NewsAPIClient(config as any);
          break;
        case 'polygon':
          client = new PolygonClient(config as any);
          break;
        default:
          console.warn(`Unknown server type: ${name}`);
      }

      if (client) {
        this.clients.set(name, client);
        this.serverStates.set(name, {
          name,
          available: true,
          requestCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
        });
      }
    });
  }

  /**
   * Initialize the manager (connect to Redis, etc.)
   */
  async initialize(): Promise<void> {
    await this.cache.connect();
    console.log('MCP Server Manager initialized');
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    await this.cache.disconnect();
    console.log('MCP Server Manager shut down');
  }

  /**
   * Execute a request to an MCP server
   */
  async executeRequest<T = any>(request: MCPRequest): Promise<MCPResponse<T>> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check cache first
      if (!request.skipCache && this.config.enableCache) {
        const cacheKey = this.cache.generateCacheKey(
          request.server,
          request.endpoint,
          request.params
        );

        const cached = await this.cache.get<T>(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // Execute with rate limiting
      const response = await this.rateLimiter.execute(
        request.server,
        () => this.executeServerRequest<T>(request),
        request.priority || 0
      );

      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateServerState(request.server, true, responseTime);

      if (response.success) {
        this.stats.successfulRequests++;

        // Cache successful responses
        if (!request.skipCache && this.config.enableCache && request.cacheConfig?.enabled !== false) {
          const cacheKey = this.cache.generateCacheKey(
            request.server,
            request.endpoint,
            request.params
          );
          const ttl = request.cacheConfig?.ttl || this.config.defaultCacheTTL;
          await this.cache.set(cacheKey, response, ttl);
        }
      } else {
        this.stats.failedRequests++;
      }

      this.stats.totalResponseTime += responseTime;

      return response;
    } catch (error) {
      this.stats.failedRequests++;
      const responseTime = Date.now() - startTime;
      this.stats.totalResponseTime += responseTime;
      this.updateServerState(request.server, false, responseTime);

      const mcpError = this.errorHandler.createError(error, request.server);

      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId: request.id,
        source: request.server,
      };
    }
  }

  /**
   * Execute request to a specific server
   */
  private async executeServerRequest<T = any>(
    request: MCPRequest
  ): Promise<MCPResponse<T>> {
    const client = this.clients.get(request.server);

    if (!client) {
      throw new Error(`No client found for server: ${request.server}`);
    }

    const serverState = this.serverStates.get(request.server);
    if (serverState && !serverState.available) {
      throw new Error(`Server ${request.server} is not available`);
    }

    // Execute with retry logic
    return await this.errorHandler.withRetry<MCPResponse<T>>(
      async () => {
        // Call the appropriate method on the client
        // This is a simplified version - in reality, you'd need to map
        // request.endpoint to the appropriate client method
        return await this.callClientMethod(client, request);
      },
      request.server,
      request
    );
  }

  /**
   * Call the appropriate method on a client based on the request
   */
  private async callClientMethod(
    client: ServerClient,
    request: MCPRequest
  ): Promise<MCPResponse> {
    // This is a generic dispatcher that calls client methods
    // In a production system, you'd want more type-safe dispatching

    const method = (client as any)[request.endpoint];
    if (typeof method !== 'function') {
      throw new Error(
        `Method ${request.endpoint} not found on ${request.server} client`
      );
    }

    // Call the method with params
    const paramsArray = Object.values(request.params);
    return await method.apply(client, paramsArray);
  }

  /**
   * Execute request with automatic fallback
   */
  async executeWithFallback<T = any>(
    request: MCPRequest
  ): Promise<MCPResponse<T>> {
    let response = await this.executeRequest<T>(request);

    // If request failed and fallback is available
    if (!response.success && response.error) {
      const fallbackServer = this.errorHandler.getFallbackServer(
        request.server
      );

      if (fallbackServer) {
        console.log(
          `Request to ${request.server} failed, trying fallback: ${fallbackServer}`
        );

        const fallbackRequest: MCPRequest = {
          ...request,
          server: fallbackServer,
        };

        response = await this.executeRequest<T>(fallbackRequest);
      }
    }

    return response;
  }

  /**
   * Batch execute multiple requests
   */
  async executeBatch(requests: MCPRequest[]): Promise<MCPResponse[]> {
    return await Promise.all(
      requests.map((request) => this.executeRequest(request))
    );
  }

  /**
   * Update server state
   */
  private updateServerState(
    serverName: string,
    success: boolean,
    responseTime: number
  ): void {
    const state = this.serverStates.get(serverName);
    if (!state) return;

    state.requestCount++;
    if (!success) {
      state.errorCount++;
    }

    // Update average response time (moving average)
    const alpha = 0.2; // Smoothing factor
    state.avgResponseTime =
      alpha * responseTime + (1 - alpha) * state.avgResponseTime;

    // Mark server as unavailable if error rate is too high
    const errorRate = state.errorCount / state.requestCount;
    if (errorRate > 0.5 && state.requestCount > 10) {
      state.available = false;
      console.warn(`Server ${serverName} marked as unavailable (error rate: ${errorRate})`);

      // Auto-recover after some time
      setTimeout(() => {
        state.available = true;
        state.errorCount = 0;
        state.requestCount = 0;
        console.log(`Server ${serverName} marked as available again`);
      }, 60000); // 1 minute
    }

    this.serverStates.set(serverName, state);
  }

  /**
   * Get statistics
   */
  getStats(): MCPManagerStats {
    const serverStates: Record<string, ServerState> = {};
    this.serverStates.forEach((state, name) => {
      serverStates[name] = { ...state };
    });

    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      avgResponseTime:
        this.stats.totalRequests > 0
          ? this.stats.totalResponseTime / this.stats.totalRequests
          : 0,
      serverStates,
    };
  }

  /**
   * Clear cache for a specific server or all servers
   */
  async clearCache(server?: string): Promise<number> {
    if (server) {
      return await this.cache.clearByPattern(server);
    } else {
      await this.cache.clearAll();
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await this.cache.getStats();
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimiterStats() {
    return this.rateLimiter.getAllStats();
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorHandler.getAllErrorStats();
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<
    Record<string, { healthy: boolean; responseTime?: number }>
  > {
    const results: Record<string, { healthy: boolean; responseTime?: number }> =
      {};

    for (const [name, client] of this.clients) {
      const startTime = Date.now();
      try {
        const healthy = await (client as any).healthCheck();
        const responseTime = Date.now() - startTime;

        results[name] = { healthy, responseTime };
      } catch (error) {
        results[name] = { healthy: false };
      }
    }

    // Check cache health
    const cacheHealthy = await this.cache.healthCheck();
    results['cache'] = { healthy: cacheHealthy };

    // Check rate limiter health
    const rateLimiterHealthy = this.rateLimiter.healthCheck();
    results['rateLimiter'] = { healthy: rateLimiterHealthy };

    // Check error handler health
    const errorHandlerHealthy = this.errorHandler.healthCheck();
    results['errorHandler'] = { healthy: errorHandlerHealthy };

    return results;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalResponseTime: 0,
    };

    this.serverStates.forEach((state) => {
      state.requestCount = 0;
      state.errorCount = 0;
      state.avgResponseTime = 0;
    });

    this.errorHandler.clearErrorLog();
  }

  /**
   * Get a specific client (for direct access if needed)
   */
  getClient<T extends ServerClient>(serverName: string): T | undefined {
    return this.clients.get(serverName) as T | undefined;
  }

  /**
   * Check if a server is available
   */
  isServerAvailable(serverName: string): boolean {
    const state = this.serverStates.get(serverName);
    return state?.available ?? false;
  }

  /**
   * Get all available servers
   */
  getAvailableServers(): string[] {
    const available: string[] = [];
    this.serverStates.forEach((state, name) => {
      if (state.available) {
        available.push(name);
      }
    });
    return available;
  }
}
