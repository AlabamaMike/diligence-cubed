/**
 * MCP Error Handler
 * Error handling with fallback sources and retry logic
 */

import { MCPError, MCPErrorType, MCPResponse, MCPRequest } from '../types/mcp';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitterMs: number;
}

export interface FallbackConfig {
  enabled: boolean;
  fallbackSources: Record<string, string[]>;
}

export class MCPErrorHandler {
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBase: 2,
    jitterMs: 500,
  };

  private readonly fallbackSources: Record<string, string[]> = {
    alphavantage: ['polygon'],
    polygon: ['alphavantage'],
    exa: ['perplexity'],
    perplexity: ['exa'],
    github: [],
    newsapi: [],
  };

  private retryConfig: RetryConfig;
  private errorLog: Map<string, MCPError[]> = new Map();
  private readonly maxErrorLogSize = 100;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...this.defaultRetryConfig, ...retryConfig };
  }

  /**
   * Handle an error and determine next action
   */
  async handleError(
    error: MCPError,
    request: MCPRequest,
    attemptNumber: number = 1
  ): Promise<{
    shouldRetry: boolean;
    shouldFallback: boolean;
    delayMs?: number;
    fallbackServer?: string;
  }> {
    // Log error
    this.logError(error);

    // Check if error is retryable
    if (!error.retryable) {
      return {
        shouldRetry: false,
        shouldFallback: this.hasFallback(request.server),
        fallbackServer: this.getFallbackServer(request.server),
      };
    }

    // Check retry attempts
    if (attemptNumber >= this.retryConfig.maxAttempts) {
      return {
        shouldRetry: false,
        shouldFallback: this.hasFallback(request.server),
        fallbackServer: this.getFallbackServer(request.server),
      };
    }

    // Calculate retry delay
    let delayMs = this.calculateRetryDelay(attemptNumber, error);

    // Handle rate limit errors specifically
    if (error.type === MCPErrorType.RATE_LIMIT && error.retryAfter) {
      delayMs = Math.max(delayMs, error.retryAfter * 1000);
    }

    return {
      shouldRetry: true,
      shouldFallback: false,
      delayMs,
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attemptNumber: number, error?: MCPError): number {
    const exponentialDelay =
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.exponentialBase, attemptNumber - 1);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.retryConfig.jitterMs;

    const delay = Math.min(
      exponentialDelay + jitter,
      this.retryConfig.maxDelayMs
    );

    return delay;
  }

  /**
   * Create MCPError from various error types
   */
  createError(
    error: any,
    server: string,
    context?: Record<string, any>
  ): MCPError {
    let errorType: MCPErrorType = MCPErrorType.SERVER_ERROR;
    let message = 'Unknown error occurred';
    let retryable = true;
    let retryAfter: number | undefined;

    // Parse error based on type
    if (error instanceof Error) {
      message = error.message;

      // Determine error type from message or properties
      if (
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('too many requests')
      ) {
        errorType = MCPErrorType.RATE_LIMIT;
        retryable = true;
        // Try to extract retry-after from error
        const retryMatch = message.match(/retry after (\d+)/i);
        if (retryMatch) {
          retryAfter = parseInt(retryMatch[1], 10);
        }
      } else if (
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('forbidden')
      ) {
        errorType = MCPErrorType.AUTHENTICATION;
        retryable = false;
      } else if (
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('timed out')
      ) {
        errorType = MCPErrorType.TIMEOUT;
        retryable = true;
      } else if (
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('404')
      ) {
        errorType = MCPErrorType.NOT_FOUND;
        retryable = false;
      } else if (
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('bad request') ||
        message.toLowerCase().includes('400')
      ) {
        errorType = MCPErrorType.INVALID_REQUEST;
        retryable = false;
      } else if (
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('connection')
      ) {
        errorType = MCPErrorType.NETWORK_ERROR;
        retryable = true;
      }
    }

    // Check for HTTP status codes
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        errorType = MCPErrorType.RATE_LIMIT;
        retryable = true;
        const retryAfterHeader = error.response.headers?.[' retry-after'];
        if (retryAfterHeader) {
          retryAfter = parseInt(retryAfterHeader, 10);
        }
      } else if (status === 401 || status === 403) {
        errorType = MCPErrorType.AUTHENTICATION;
        retryable = false;
      } else if (status === 404) {
        errorType = MCPErrorType.NOT_FOUND;
        retryable = false;
      } else if (status === 400) {
        errorType = MCPErrorType.INVALID_REQUEST;
        retryable = false;
      } else if (status >= 500) {
        errorType = MCPErrorType.SERVER_ERROR;
        retryable = true;
      }
    }

    return {
      type: errorType,
      errorType: errorType,
      message,
      server: server as any, // Cast to MCPServerType
      timestamp: new Date(),
      retryable,
      retryAfter,
    };
  }

  /**
   * Get fallback server for a given server
   */
  getFallbackServer(server: string): string | undefined {
    const fallbacks = this.fallbackSources[server];
    if (!fallbacks || fallbacks.length === 0) {
      return undefined;
    }

    // Return first available fallback
    // In a more advanced implementation, could check server health
    return fallbacks[0];
  }

  /**
   * Check if server has fallback
   */
  hasFallback(server: string): boolean {
    const fallbacks = this.fallbackSources[server];
    return fallbacks !== undefined && fallbacks.length > 0;
  }

  /**
   * Register custom fallback sources
   */
  registerFallback(server: string, fallbacks: string[]): void {
    this.fallbackSources[server] = fallbacks;
  }

  /**
   * Log error for monitoring
   */
  private logError(error: MCPError): void {
    const serverErrors = this.errorLog.get(error.server) || [];
    serverErrors.push(error);

    // Keep only recent errors
    if (serverErrors.length > this.maxErrorLogSize) {
      serverErrors.shift();
    }

    this.errorLog.set(error.server, serverErrors);
  }

  /**
   * Get error statistics for a server
   */
  getErrorStats(server: string): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: MCPError[];
    errorRate: number; // Errors per minute
  } {
    const errors = this.errorLog.get(server) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const recentErrors = errors.filter(
      (e) => e.timestamp.getTime() > oneMinuteAgo
    );

    const errorsByType = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: errors.length,
      errorsByType,
      recentErrors: errors.slice(-10), // Last 10 errors
      errorRate: recentErrors.length, // Errors in last minute
    };
  }

  /**
   * Get all error statistics
   */
  getAllErrorStats(): Record<string, ReturnType<typeof this.getErrorStats>> {
    const stats: Record<string, any> = {};

    this.errorLog.forEach((_, server) => {
      stats[server] = this.getErrorStats(server);
    });

    return stats;
  }

  /**
   * Clear error log for a server
   */
  clearErrorLog(server?: string): void {
    if (server) {
      this.errorLog.delete(server);
    } else {
      this.errorLog.clear();
    }
  }

  /**
   * Wrap a function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    server: string,
    request: MCPRequest
  ): Promise<T> {
    let lastError: MCPError | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = this.createError(error, server);

        const { shouldRetry, delayMs } = await this.handleError(
          lastError,
          request,
          attempt
        );

        if (!shouldRetry) {
          throw lastError;
        }

        if (delayMs) {
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper to sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error handler is healthy
   */
  healthCheck(): boolean {
    // Check error rates for all servers
    const maxErrorRate = 10; // errors per minute

    for (const [server, _] of this.errorLog) {
      const stats = this.getErrorStats(server);
      if (stats.errorRate > maxErrorRate) {
        console.warn(`High error rate for ${server}: ${stats.errorRate}/min`);
        return false;
      }
    }

    return true;
  }
}
