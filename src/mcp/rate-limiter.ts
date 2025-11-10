/**
 * MCP Rate Limiter
 * Per-server rate limiting with request queueing
 */

import { RateLimitConfig, MCPError, MCPErrorType } from '../types/mcp';

interface RateLimitState {
  requests: number[];
  queue: QueuedTask[];
  processing: boolean;
  concurrentRequests: number;
}

interface QueuedTask {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
}

export class RateLimiter {
  private limiters: Map<string, RateLimitState> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {}

  /**
   * Register a rate limit configuration for a server
   */
  register(serverName: string, config: RateLimitConfig): void {
    this.configs.set(serverName, config);
    this.limiters.set(serverName, {
      requests: [],
      queue: [],
      processing: false,
      concurrentRequests: 0,
    });
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(
    serverName: string,
    fn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    const config = this.configs.get(serverName);
    if (!config) {
      throw new Error(`No rate limit config found for server: ${serverName}`);
    }

    const state = this.limiters.get(serverName)!;

    // Check if we can execute immediately
    if (this.canExecuteNow(serverName)) {
      return this.executeTask(serverName, fn);
    }

    // Queue the task
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = {
        execute: fn,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
      };

      state.queue.push(task);
      // Sort by priority (higher first) and then by timestamp (older first)
      state.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Process queue
      this.processQueue(serverName);
    });
  }

  /**
   * Check if a request can be executed immediately
   */
  private canExecuteNow(serverName: string): boolean {
    const config = this.configs.get(serverName)!;
    const state = this.limiters.get(serverName)!;

    // Check concurrent requests limit
    const maxConcurrent = config.concurrentRequests || Infinity;
    if (state.concurrentRequests >= maxConcurrent) {
      return false;
    }

    // Clean up old requests
    this.cleanupOldRequests(serverName);

    // Check rate limit
    const now = Date.now();
    const intervalMs = this.getIntervalMs(config.interval);
    const recentRequests = state.requests.filter(
      (time) => now - time < intervalMs
    );

    return recentRequests.length < config.requestsPerInterval;
  }

  /**
   * Execute a task and track it
   */
  private async executeTask<T>(
    serverName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const state = this.limiters.get(serverName)!;
    const now = Date.now();

    // Record request
    state.requests.push(now);
    state.concurrentRequests++;

    try {
      const result = await fn();
      return result;
    } finally {
      state.concurrentRequests--;
      // Process next task in queue
      setTimeout(() => this.processQueue(serverName), 0);
    }
  }

  /**
   * Process queued tasks
   */
  private async processQueue(serverName: string): Promise<void> {
    const state = this.limiters.get(serverName)!;

    // Avoid concurrent processing
    if (state.processing || state.queue.length === 0) {
      return;
    }

    state.processing = true;

    try {
      while (state.queue.length > 0 && this.canExecuteNow(serverName)) {
        const task = state.queue.shift()!;

        try {
          const result = await this.executeTask(serverName, task.execute);
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        }

        // Small delay between requests to avoid bursting
        await this.sleep(10);
      }
    } finally {
      state.processing = false;
    }

    // Continue processing if there are more tasks
    if (state.queue.length > 0) {
      const config = this.configs.get(serverName)!;
      const intervalMs = this.getIntervalMs(config.interval);
      const waitTime = this.getTimeUntilNextSlot(serverName);

      setTimeout(() => this.processQueue(serverName), waitTime);
    }
  }

  /**
   * Get time in milliseconds until next available slot
   */
  private getTimeUntilNextSlot(serverName: string): number {
    const config = this.configs.get(serverName)!;
    const state = this.limiters.get(serverName)!;
    const intervalMs = this.getIntervalMs(config.interval);
    const now = Date.now();

    this.cleanupOldRequests(serverName);

    if (state.requests.length < config.requestsPerInterval) {
      return 0;
    }

    // Find oldest request in current window
    const oldestRequest = Math.min(...state.requests);
    const waitTime = oldestRequest + intervalMs - now;

    return Math.max(0, waitTime);
  }

  /**
   * Clean up requests outside the current window
   */
  private cleanupOldRequests(serverName: string): void {
    const config = this.configs.get(serverName)!;
    const state = this.limiters.get(serverName)!;
    const intervalMs = this.getIntervalMs(config.interval);
    const now = Date.now();

    state.requests = state.requests.filter((time) => now - time < intervalMs);
  }

  /**
   * Convert interval to milliseconds
   */
  private getIntervalMs(
    interval: 'second' | 'minute' | 'hour' | 'day' | 'month'
  ): number {
    const intervals = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    return intervals[interval];
  }

  /**
   * Get queue status for a server
   */
  getQueueStatus(serverName: string): {
    queueLength: number;
    concurrentRequests: number;
    recentRequests: number;
    estimatedWaitTime: number;
  } {
    const state = this.limiters.get(serverName);
    if (!state) {
      return {
        queueLength: 0,
        concurrentRequests: 0,
        recentRequests: 0,
        estimatedWaitTime: 0,
      };
    }

    this.cleanupOldRequests(serverName);

    const estimatedWaitTime = this.getTimeUntilNextSlot(serverName);

    return {
      queueLength: state.queue.length,
      concurrentRequests: state.concurrentRequests,
      recentRequests: state.requests.length,
      estimatedWaitTime,
    };
  }

  /**
   * Clear queue for a server
   */
  clearQueue(serverName: string): void {
    const state = this.limiters.get(serverName);
    if (state) {
      // Reject all queued tasks
      state.queue.forEach((task) => {
        const error: MCPError = {
          type: MCPErrorType.SERVER_ERROR,
          errorType: MCPErrorType.SERVER_ERROR,
          message: 'Queue cleared',
          server: serverName as any,
          timestamp: new Date(),
          retryable: false,
        };
        task.reject(error);
      });

      state.queue = [];
    }
  }

  /**
   * Reset rate limiter for a server
   */
  reset(serverName: string): void {
    const state = this.limiters.get(serverName);
    if (state) {
      state.requests = [];
      this.clearQueue(serverName);
    }
  }

  /**
   * Get all rate limiter stats
   */
  getAllStats(): Record<
    string,
    {
      queueLength: number;
      concurrentRequests: number;
      recentRequests: number;
      estimatedWaitTime: number;
    }
  > {
    const stats: Record<string, any> = {};

    this.limiters.forEach((_, serverName) => {
      stats[serverName] = this.getQueueStatus(serverName);
    });

    return stats;
  }

  /**
   * Helper to sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if rate limiter is healthy
   */
  healthCheck(): boolean {
    // Check if any queue is excessively long
    const maxQueueLength = 1000;

    for (const [serverName, state] of this.limiters) {
      if (state.queue.length > maxQueueLength) {
        console.warn(
          `Rate limiter queue for ${serverName} is too long: ${state.queue.length}`
        );
        return false;
      }
    }

    return true;
  }
}
