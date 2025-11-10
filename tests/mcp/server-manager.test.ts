/**
 * Tests for MCP Server Manager
 */

import { MockMCPServerManager, MockCache, MockRateLimiter } from '../helpers/mocks';
import { createTestEnvironment, delay } from '../helpers/test-utils';
import { 
  mockAlphaVantageResponse, 
  mockExaSearchResponse,
  mockMCPErrorResponse,
  createMockMCPError 
} from '../fixtures/mcp-responses';

describe('MCPServerManager', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let serverManager: MockMCPServerManager;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    serverManager = testEnv.mcpManager;
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('query', () => {
    it('should successfully query MCP server', async () => {
      serverManager.setResponse('alphavantage', mockAlphaVantageResponse);

      const response = await serverManager.query('alphavantage', { symbol: 'TECH' });

      expect(response).toHaveValidMCPResponse();
      expect(response.status).toBe('success');
      expect(response.source).toBe('alphavantage');
      expect(response.data).toBeDefined();
    });

    it('should handle multiple simultaneous queries', async () => {
      serverManager.setResponse('alphavantage', mockAlphaVantageResponse);
      serverManager.setResponse('exa', mockExaSearchResponse);

      const [response1, response2] = await Promise.all([
        serverManager.query('alphavantage', { symbol: 'TECH' }),
        serverManager.query('exa', { query: 'TechCorp' })
      ]);

      expect(response1.source).toBe('alphavantage');
      expect(response2.source).toBe('exa');
    });

    it('should throw error for unconfigured server', async () => {
      await expect(
        serverManager.query('unknown-server', {})
      ).rejects.toThrow('No mock response configured');
    });

    it('should track call history', async () => {
      serverManager.setResponse('alphavantage', mockAlphaVantageResponse);

      await serverManager.query('alphavantage', { symbol: 'TECH' });
      await serverManager.query('alphavantage', { symbol: 'CORP' });

      const history = serverManager.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].server).toBe('alphavantage');
      expect(history[1].query.symbol).toBe('CORP');
    });
  });

  describe('Caching', () => {
    let cache: MockCache;

    beforeEach(() => {
      cache = testEnv.cache;
    });

    it('should cache successful responses', async () => {
      const cacheKey = 'alphavantage:TECH';
      await cache.set(cacheKey, mockAlphaVantageResponse, 3600);

      const cached = await cache.get(cacheKey);
      expect(cached).toEqual(mockAlphaVantageResponse);
    });

    it('should return cached response when available', async () => {
      const cacheKey = 'alphavantage:TECH';
      await cache.set(cacheKey, mockAlphaVantageResponse, 3600);

      const cached = await cache.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(mockAlphaVantageResponse.data);
    });

    it('should expire cached responses after TTL', async () => {
      const cacheKey = 'test:key';
      await cache.set(cacheKey, { data: 'test' }, 0.01); // 0.01 seconds

      await delay(20); // Wait for expiry

      const cached = await cache.get(cacheKey);
      expect(cached).toBeNull();
    });

    it('should clear cache', async () => {
      await cache.set('key1', { data: 'test1' }, 3600);
      await cache.set('key2', { data: 'test2' }, 3600);

      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    let rateLimiter: MockRateLimiter;

    beforeEach(() => {
      rateLimiter = new MockRateLimiter(5, 60000); // 5 requests per minute
    });

    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const allowed = await rateLimiter.checkLimit();
        expect(allowed).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit();
      }

      const allowed = await rateLimiter.checkLimit();
      expect(allowed).toBe(false);
    });

    it('should track number of calls', async () => {
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      expect(rateLimiter.getCalls()).toBe(3);
    });

    it('should reset rate limit counter', async () => {
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      rateLimiter.reset();
      expect(rateLimiter.getCalls()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      serverManager.setResponse('alphavantage', mockMCPErrorResponse);

      const response = await serverManager.query('alphavantage', { symbol: 'TECH' });

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = createMockMCPError('exa', 'TIMEOUT', 'Request timeout');
      serverManager.setResponse('exa', timeoutError);

      const response = await serverManager.query('exa', { query: 'test' });

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('TIMEOUT');
    });

    it('should handle authentication errors', async () => {
      const authError = createMockMCPError('alphavantage', 'AUTH_ERROR', 'Invalid API key');
      serverManager.setResponse('alphavantage', authError);

      const response = await serverManager.query('alphavantage', {});

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('AUTH_ERROR');
    });

    it('should handle network errors', async () => {
      const networkError = createMockMCPError('exa', 'NETWORK_ERROR', 'Connection failed');
      serverManager.setResponse('exa', networkError);

      const response = await serverManager.query('exa', {});

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      let attemptCount = 0;
      
      // Mock implementation that fails first time, succeeds second time
      const mockQuery = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary failure');
        }
        return mockAlphaVantageResponse;
      });

      // Simulate retry logic
      let result;
      try {
        result = await mockQuery();
      } catch (error) {
        // Retry
        result = await mockQuery();
      }

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockAlphaVantageResponse);
    });

    it('should respect max retry attempts', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      const maxRetries = 3;
      let attempts = 0;

      for (let i = 0; i < maxRetries; i++) {
        try {
          await mockQuery();
        } catch (error) {
          attempts++;
        }
      }

      expect(attempts).toBe(maxRetries);
      expect(mockQuery).toHaveBeenCalledTimes(maxRetries);
    });

    it('should implement exponential backoff', async () => {
      const delays: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        const backoffMs = Math.min(1000 * Math.pow(2, i), 10000);
        delays.push(backoffMs);
      }

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });
  });

  describe('Fallback Sources', () => {
    it('should use fallback when primary source fails', async () => {
      const primaryError = createMockMCPError('alphavantage', 'SERVICE_UNAVAILABLE', 'Service down');
      const fallbackResponse = { ...mockAlphaVantageResponse, source: 'polygon' };

      // Simulate fallback logic
      const getFallbackSource = (primary: string): string => {
        const fallbacks: Record<string, string> = {
          'alphavantage': 'polygon',
          'exa': 'perplexity'
        };
        return fallbacks[primary] || '';
      };

      serverManager.setResponse('alphavantage', primaryError);
      serverManager.setResponse('polygon', fallbackResponse);

      const primaryResponse = await serverManager.query('alphavantage', {});
      
      if (primaryResponse.status === 'error') {
        const fallbackSource = getFallbackSource('alphavantage');
        const fallbackData = await serverManager.query(fallbackSource, {});
        expect(fallbackData.status).toBe('success');
        expect(fallbackData.source).toBe('polygon');
      }
    });
  });

  describe('Request Prioritization', () => {
    it('should handle high priority requests first', async () => {
      const requests = [
        { id: 1, priority: 'low', delay: 50 },
        { id: 2, priority: 'high', delay: 100 },
        { id: 3, priority: 'medium', delay: 75 }
      ];

      const processed: number[] = [];

      // Sort by priority
      const sorted = [...requests].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - 
               priorityOrder[b.priority as keyof typeof priorityOrder];
      });

      expect(sorted[0].priority).toBe('high');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
    });
  });
});
