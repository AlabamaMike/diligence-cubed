/**
 * Tests for Individual MCP Clients
 */

import { MockMCPServerManager } from '../helpers/mocks';
import { createTestEnvironment } from '../helpers/test-utils';
import {
  mockAlphaVantageResponse,
  mockExaSearchResponse,
  mockGitHubResponse,
  mockPolygonResponse
} from '../fixtures/mcp-responses';

describe('MCP Individual Clients', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('AlphaVantage Client', () => {
    it('should fetch company fundamentals', async () => {
      testEnv.mcpManager.setResponse('alphavantage', mockAlphaVantageResponse);

      const response = await testEnv.mcpManager.query('alphavantage', {
        function: 'INCOME_STATEMENT',
        symbol: 'TECH'
      });

      expect(response.status).toBe('success');
      expect(response.data.annualReports).toBeDefined();
      expect(response.data.annualReports.length).toBeGreaterThan(0);
    });

    it('should fetch quarterly earnings', async () => {
      testEnv.mcpManager.setResponse('alphavantage', mockAlphaVantageResponse);

      const response = await testEnv.mcpManager.query('alphavantage', {
        function: 'EARNINGS',
        symbol: 'TECH'
      });

      expect(response.data.quarterlyReports).toBeDefined();
    });
  });

  describe('Exa.ai Client', () => {
    it('should perform deep web search', async () => {
      testEnv.mcpManager.setResponse('exa', mockExaSearchResponse);

      const response = await testEnv.mcpManager.query('exa', {
        query: 'TechCorp company analysis',
        num_results: 10
      });

      expect(response.status).toBe('success');
      expect(response.data.results).toBeDefined();
      expect(response.data.results.length).toBeGreaterThan(0);
      expect(response.data.results[0]).toHaveProperty('title');
      expect(response.data.results[0]).toHaveProperty('url');
    });

    it('should return results sorted by relevance', async () => {
      testEnv.mcpManager.setResponse('exa', mockExaSearchResponse);

      const response = await testEnv.mcpManager.query('exa', {
        query: 'TechCorp',
        sort: 'relevance'
      });

      const results = response.data.results;
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('GitHub Client', () => {
    it('should fetch organization repositories', async () => {
      testEnv.mcpManager.setResponse('github', mockGitHubResponse);

      const response = await testEnv.mcpManager.query('github', {
        org: 'techcorp',
        type: 'repositories'
      });

      expect(response.status).toBe('success');
      expect(response.data.repositories).toBeDefined();
      expect(response.data.repositories.length).toBeGreaterThan(0);
    });

    it('should analyze code quality metrics', async () => {
      testEnv.mcpManager.setResponse('github', mockGitHubResponse);

      const response = await testEnv.mcpManager.query('github', {
        org: 'techcorp'
      });

      const repo = response.data.repositories[0];
      expect(repo).toHaveProperty('stars');
      expect(repo).toHaveProperty('forks');
      expect(repo).toHaveProperty('openIssues');
      expect(repo).toHaveProperty('contributors');
    });
  });

  describe('Polygon.io Client', () => {
    it('should fetch stock market data', async () => {
      testEnv.mcpManager.setResponse('polygon', mockPolygonResponse);

      const response = await testEnv.mcpManager.query('polygon', {
        ticker: 'TECH',
        from: '2024-01-01',
        to: '2024-12-31'
      });

      expect(response.status).toBe('success');
      expect(response.data.results).toBeDefined();
      expect(response.data.results.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Client Integration', () => {
    it('should aggregate data from multiple clients', async () => {
      testEnv.mcpManager.setResponse('alphavantage', mockAlphaVantageResponse);
      testEnv.mcpManager.setResponse('exa', mockExaSearchResponse);
      testEnv.mcpManager.setResponse('github', mockGitHubResponse);

      const [financial, web, technical] = await Promise.all([
        testEnv.mcpManager.query('alphavantage', { symbol: 'TECH' }),
        testEnv.mcpManager.query('exa', { query: 'TechCorp' }),
        testEnv.mcpManager.query('github', { org: 'techcorp' })
      ]);

      expect(financial.status).toBe('success');
      expect(web.status).toBe('success');
      expect(technical.status).toBe('success');
    });
  });
});
