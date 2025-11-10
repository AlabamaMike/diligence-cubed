/**
 * Custom error classes for the platform
 */

export class DiligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'DiligenceError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AgentError extends DiligenceError {
  constructor(
    message: string,
    public agentType: string,
    public taskId?: string
  ) {
    super(message, 'AGENT_ERROR', 500);
    this.name = 'AgentError';
  }
}

export class MCPError extends DiligenceError {
  constructor(
    message: string,
    public serverType: string,
    public errorType: 'rate_limit' | 'authentication' | 'timeout' | 'server_error' | 'unknown',
    public retryable: boolean = false
  ) {
    super(message, 'MCP_ERROR', 502);
    this.name = 'MCPError';
  }
}

export class ValidationError extends DiligenceError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DiligenceError {
  constructor(message: string, public resourceType: string, public resourceId: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}
