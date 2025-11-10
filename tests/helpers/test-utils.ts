/**
 * Test utility functions
 */

import { MockMCPServerManager, MockCache, MockRateLimiter } from './mocks';

/**
 * Create a complete test environment
 */
export function createTestEnvironment() {
  const mcpManager = new MockMCPServerManager();
  const cache = new MockCache();
  const rateLimiter = new MockRateLimiter(100, 60000);

  return {
    mcpManager,
    cache,
    rateLimiter,
    cleanup: () => {
      mcpManager.reset();
      cache.clear();
      rateLimiter.reset();
    }
  };
}

/**
 * Assert that an async function throws a specific error
 */
export async function expectAsyncThrow(
  fn: () => Promise<any>,
  errorMessage?: string
) {
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  expect(error).toBeDefined();
  if (errorMessage) {
    expect(error?.message).toContain(errorMessage);
  }
}

/**
 * Assert array contains objects matching partial criteria
 */
export function expectArrayToContainObject(
  array: any[],
  expectedObject: Partial<any>
) {
  const match = array.some(item => {
    return Object.keys(expectedObject).every(key => {
      return item[key] === expectedObject[key];
    });
  });

  expect(match).toBe(true);
}

/**
 * Deep clone object for test isolation
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate random test data
 */
export function generateRandomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

export function generateRandomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Create a delay for testing timing-dependent code
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock timestamp for consistent testing
 */
export function mockTimestamp(date: string = '2025-01-01T00:00:00.000Z'): string {
  return date;
}

/**
 * Assert object structure matches schema
 */
export function expectObjectToMatchSchema(
  obj: any,
  schema: Record<string, string>
) {
  Object.keys(schema).forEach(key => {
    expect(obj).toHaveProperty(key);
    expect(typeof obj[key]).toBe(schema[key]);
  });
}

/**
 * Create a test logger that captures logs
 */
export class TestLogger {
  public logs: Array<{ level: string; message: string; data?: any }> = [];

  log(message: string, data?: any) {
    this.logs.push({ level: 'log', message, data });
  }

  error(message: string, data?: any) {
    this.logs.push({ level: 'error', message, data });
  }

  warn(message: string, data?: any) {
    this.logs.push({ level: 'warn', message, data });
  }

  info(message: string, data?: any) {
    this.logs.push({ level: 'info', message, data });
  }

  debug(message: string, data?: any) {
    this.logs.push({ level: 'debug', message, data });
  }

  clear() {
    this.logs = [];
  }

  getLogs(level?: string) {
    return level 
      ? this.logs.filter(log => log.level === level)
      : this.logs;
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTracker {
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = performance.now();
  }

  stop() {
    this.endTime = performance.now();
  }

  getDuration(): number {
    return this.endTime - this.startTime;
  }

  assertDurationLessThan(maxMs: number) {
    const duration = this.getDuration();
    expect(duration).toBeLessThan(maxMs);
  }
}

/**
 * Retry a test assertion multiple times
 */
export async function retryAssertion(
  assertion: () => void | Promise<void>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<void> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Create a mock API response
 */
export function createMockAPIResponse<T>(
  data: T,
  status: number = 200,
  statusText: string = 'OK'
) {
  return {
    data,
    status,
    statusText,
    headers: {},
    config: {} as any
  };
}

/**
 * Assert promises resolve in expected order
 */
export async function expectPromiseOrder(
  promises: Array<() => Promise<any>>,
  expectedOrder: number[]
) {
  const results: number[] = [];
  const wrapped = promises.map((promise, index) =>
    promise().then(() => results.push(index))
  );

  await Promise.all(wrapped);
  expect(results).toEqual(expectedOrder);
}
