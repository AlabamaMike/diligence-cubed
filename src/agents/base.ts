/**
 * Base Agent class for all specialized agents
 * Provides common functionality and interface that all agents must implement
 */

import { AgentExecutionResult, AgentError } from '../types/agents';

export interface AgentConfig {
  name: string;
  type: string;
  maxRetries?: number;
  timeout?: number;
  enableCaching?: boolean;
}

export interface AgentMetrics {
  executionTime: number;
  dataPoints: number;
  sources: string[];
  confidence: number;
  retryCount: number;
}

export abstract class BaseAgent {
  protected readonly name: string;
  protected readonly type: string;
  protected readonly maxRetries: number;
  protected readonly timeout: number;
  protected readonly enableCaching: boolean;
  protected metrics: Partial<AgentMetrics>;
  protected startTime?: number;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.type = config.type;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 300000; // 5 minutes default
    this.enableCaching = config.enableCaching !== false;
    this.metrics = {
      dataPoints: 0,
      sources: [],
      retryCount: 0,
    };
  }

  /**
   * Main execution method - must be implemented by each specialized agent
   */
  protected abstract executeInternal(input: any): Promise<any>;

  /**
   * Validate input before processing - can be overridden
   */
  protected validateInput(input: any): void {
    if (!input) {
      throw new AgentError('Input is required', this.type);
    }
  }

  /**
   * Public execute method with error handling, retries, and metrics
   */
  async execute(input: any): Promise<AgentExecutionResult> {
    this.startTime = Date.now();
    let lastError: Error | undefined;

    // Validate input
    try {
      this.validateInput(input);
    } catch (error) {
      return this.createErrorResult(error as Error);
    }

    // Execute with retries
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.metrics.retryCount = attempt;
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }

        const result = await this.executeWithTimeout(input);
        return this.createSuccessResult(result);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `${this.type} attempt ${attempt + 1}/${this.maxRetries + 1} failed:`,
          error
        );

        // Don't retry if it's not a retryable error
        if (error instanceof AgentError && !error.retryable) {
          break;
        }
      }
    }

    // All retries failed
    return this.createErrorResult(lastError || new Error('Unknown error'));
  }

  /**
   * Execute with timeout wrapper
   */
  private async executeWithTimeout(input: any): Promise<any> {
    return Promise.race([
      this.executeInternal(input),
      this.createTimeoutPromise(),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new AgentError(
            `Execution timeout after ${this.timeout}ms`,
            this.type,
            undefined,
            true // Retryable
          )
        );
      }, this.timeout);
    });
  }

  /**
   * Create a successful result object
   */
  private createSuccessResult(data: any): AgentExecutionResult {
    const executionTime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      agentId: this.name,
      agentType: this.type,
      status: 'success',
      data,
      metadata: {
        executionTime,
        dataPoints: this.metrics.dataPoints || 0,
        sources: this.metrics.sources || [],
        confidence: this.calculateConfidence(),
      },
      warnings: [],
      errors: [],
      timestamp: new Date(),
    };
  }

  /**
   * Create an error result object
   */
  private createErrorResult(error: Error): AgentExecutionResult {
    const executionTime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      agentId: this.name,
      agentType: this.type,
      status: 'failed',
      data: null,
      metadata: {
        executionTime,
        dataPoints: 0,
        sources: [],
        confidence: 0,
      },
      warnings: [],
      errors: [error.message],
      timestamp: new Date(),
    };
  }

  /**
   * Calculate confidence score based on data quality
   * Can be overridden by specialized agents
   */
  protected calculateConfidence(): number {
    const dataPoints = this.metrics.dataPoints || 0;
    const sources = (this.metrics.sources || []).length;
    const retries = this.metrics.retryCount || 0;

    // Base confidence on data points and sources
    let confidence = Math.min(100, (dataPoints * 10 + sources * 20) / 2);

    // Reduce confidence for retries
    confidence -= retries * 10;

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Update metrics during execution
   */
  protected updateMetrics(update: Partial<AgentMetrics>): void {
    if (update.dataPoints !== undefined) {
      this.metrics.dataPoints = (this.metrics.dataPoints || 0) + update.dataPoints;
    }
    if (update.sources) {
      this.metrics.sources = [
        ...(this.metrics.sources || []),
        ...update.sources,
      ];
    }
    if (update.confidence !== undefined) {
      this.metrics.confidence = update.confidence;
    }
  }

  /**
   * Add a data source to metrics
   */
  protected addSource(source: string): void {
    if (!this.metrics.sources) {
      this.metrics.sources = [];
    }
    if (!this.metrics.sources.includes(source)) {
      this.metrics.sources.push(source);
    }
  }

  /**
   * Increment data points counter
   */
  protected incrementDataPoints(count: number = 1): void {
    this.metrics.dataPoints = (this.metrics.dataPoints || 0) + count;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get agent information
   */
  getInfo(): { name: string; type: string } {
    return {
      name: this.name,
      type: this.type,
    };
  }

  /**
   * Helper method to handle errors consistently
   */
  protected handleError(error: any, context: string): never {
    if (error instanceof AgentError) {
      throw error;
    }
    throw new AgentError(
      `Error in ${context}: ${error.message}`,
      this.type,
      error,
      true // Most errors are retryable
    );
  }

  /**
   * Helper method to log agent activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.type}] ${message}`;

    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }
}
