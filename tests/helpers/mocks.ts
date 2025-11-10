/**
 * Mock utilities for testing
 */

export interface MockMCPResponse {
  data: any;
  status: 'success' | 'error' | 'pending';
  source: string;
  timestamp: string;
  cached: boolean;
}

export interface MockAgentResult {
  agentId: string;
  status: 'completed' | 'failed' | 'pending';
  findings: any;
  confidence: number;
  sources: string[];
  timestamp: string;
}

/**
 * Mock MCP Server Manager
 */
export class MockMCPServerManager {
  private responses: Map<string, MockMCPResponse> = new Map();
  private callHistory: Array<{ server: string; query: any }> = [];

  setResponse(server: string, response: MockMCPResponse) {
    this.responses.set(server, response);
  }

  async query(server: string, query: any): Promise<MockMCPResponse> {
    this.callHistory.push({ server, query });
    
    const response = this.responses.get(server);
    if (!response) {
      throw new Error(`No mock response configured for server: ${server}`);
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return response;
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  reset() {
    this.responses.clear();
    this.callHistory = [];
  }
}

/**
 * Mock Agent base class
 */
export class MockAgent {
  public name: string;
  public executionCount: number = 0;
  private shouldFail: boolean = false;

  constructor(name: string) {
    this.name = name;
  }

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async execute(input: any): Promise<MockAgentResult> {
    this.executionCount++;

    if (this.shouldFail) {
      throw new Error(`Agent ${this.name} execution failed`);
    }

    return {
      agentId: this.name,
      status: 'completed',
      findings: { mockData: true },
      confidence: 0.95,
      sources: ['mock-source'],
      timestamp: new Date().toISOString()
    };
  }

  async validate(result: any): Promise<boolean> {
    return !this.shouldFail;
  }
}

/**
 * Mock Rate Limiter
 */
export class MockRateLimiter {
  private calls: number = 0;
  private limit: number;
  private window: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }

  async checkLimit(): Promise<boolean> {
    this.calls++;
    return this.calls <= this.limit;
  }

  reset() {
    this.calls = 0;
  }

  getCalls() {
    return this.calls;
  }
}

/**
 * Mock Cache
 */
export class MockCache {
  private store: Map<string, { value: any; expiry: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

/**
 * Mock Workflow Context
 */
export class MockWorkflowContext {
  public company: string;
  public results: Map<string, any> = new Map();
  public stage: string = 'initial';

  constructor(company: string) {
    this.company = company;
  }

  update(agentId: string, result: any) {
    this.results.set(agentId, result);
  }

  setStage(stage: string) {
    this.stage = stage;
  }

  getResult(agentId: string) {
    return this.results.get(agentId);
  }
}

/**
 * Create mock financial data
 */
export function createMockFinancialData(overrides: Partial<any> = {}) {
  return {
    revenue: {
      current_arr: 50000000,
      growth_rate: 0.45,
      revenue_quality: 0.85,
      ...overrides.revenue
    },
    profitability: {
      gross_margin: 0.75,
      ebitda_margin: 0.25,
      fcf_conversion: 0.80,
      ...overrides.profitability
    },
    valuation: {
      enterprise_value: 200000000,
      ev_revenue_multiple: 4.0,
      dcf_valuation: 185000000,
      comparables_range: [3.5, 5.0],
      ...overrides.valuation
    },
    red_flags: [],
    opportunities: ['Strong growth', 'High margins'],
    ...overrides
  };
}

/**
 * Create mock market data
 */
export function createMockMarketData(overrides: Partial<any> = {}) {
  return {
    market_size: {
      tam: 10000000000,
      sam: 2000000000,
      som: 200000000,
      ...overrides.market_size
    },
    growth_drivers: [
      'Digital transformation',
      'Regulatory changes',
      'Technology adoption'
    ],
    competitive_intensity: 'medium',
    barriers_to_entry: 'high',
    ...overrides
  };
}

/**
 * Create mock competitive data
 */
export function createMockCompetitiveData(overrides: Partial<any> = {}) {
  return {
    direct_competitors: ['Competitor A', 'Competitor B'],
    market_share: 0.15,
    competitive_advantages: [
      'Technology leadership',
      'Brand recognition',
      'Customer relationships'
    ],
    threats: ['New entrants', 'Price competition'],
    moat_score: 7.5,
    ...overrides
  };
}

/**
 * Wait for async operations with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

/**
 * Spy on async function calls
 */
export class AsyncSpy {
  public calls: any[][] = [];
  public results: any[] = [];

  wrap<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: any[]) => {
      this.calls.push(args);
      const result = await fn(...args);
      this.results.push(result);
      return result;
    }) as T;
  }

  reset() {
    this.calls = [];
    this.results = [];
  }
}
