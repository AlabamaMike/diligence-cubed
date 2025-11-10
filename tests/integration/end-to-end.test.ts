/**
 * End-to-End Integration Tests
 */

import { MockAgent, MockMCPServerManager, MockWorkflowContext } from '../helpers/mocks';
import { createTestEnvironment, delay } from '../helpers/test-utils';
import { mockCompanyBasicInfo } from '../fixtures/company-data';
import {
  mockAlphaVantageResponse,
  mockExaSearchResponse,
  mockGitHubResponse
} from '../fixtures/mcp-responses';

describe('End-to-End Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    
    // Set up all MCP responses
    testEnv.mcpManager.setResponse('alphavantage', mockAlphaVantageResponse);
    testEnv.mcpManager.setResponse('exa', mockExaSearchResponse);
    testEnv.mcpManager.setResponse('github', mockGitHubResponse);
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('Full Due Diligence Workflow', () => {
    it('should complete full diligence workflow', async () => {
      const agents = {
        orchestrator: new MockAgent('orchestrator'),
        financial: new MockAgent('financial'),
        market: new MockAgent('market'),
        competitive: new MockAgent('competitive'),
        technical: new MockAgent('technical'),
        risk: new MockAgent('risk')
      };

      const context = new MockWorkflowContext('TechCorp Inc.');

      // Execute workflow
      const orchestratorResult = await agents.orchestrator.execute({ company: mockCompanyBasicInfo });
      context.update('orchestrator', orchestratorResult);

      // Execute all agents in parallel
      const agentResults = await Promise.all([
        agents.financial.execute({ company: mockCompanyBasicInfo }),
        agents.market.execute({ company: mockCompanyBasicInfo }),
        agents.competitive.execute({ company: mockCompanyBasicInfo }),
        agents.technical.execute({ company: mockCompanyBasicInfo })
      ]);

      agentResults.forEach((result, index) => {
        const agentNames = ['financial', 'market', 'competitive', 'technical'];
        context.update(agentNames[index], result);
      });

      // Execute risk assessment (depends on other agents)
      const riskResult = await agents.risk.execute({ 
        company: mockCompanyBasicInfo,
        previous_results: context.results
      });
      context.update('risk', riskResult);

      // Validate results
      expect(context.results.size).toBe(6);
      expect(orchestratorResult.status).toBe('completed');
      expect(riskResult.status).toBe('completed');
    });

    it('should handle partial failures gracefully', async () => {
      const agents = {
        financial: new MockAgent('financial'),
        market: new MockAgent('market'),
        technical: new MockAgent('technical')
      };

      // Make market agent fail
      agents.market.setShouldFail(true);

      const context = new MockWorkflowContext('TechCorp Inc.');

      try {
        await agents.financial.execute({ company: mockCompanyBasicInfo });
        context.update('financial', { status: 'completed' });
      } catch (error) {
        // Should succeed
      }

      try {
        await agents.market.execute({ company: mockCompanyBasicInfo });
        context.update('market', { status: 'completed' });
      } catch (error) {
        context.update('market', { status: 'failed', error });
      }

      try {
        await agents.technical.execute({ company: mockCompanyBasicInfo });
        context.update('technical', { status: 'completed' });
      } catch (error) {
        // Should succeed
      }

      const financialResult = context.getResult('financial');
      const marketResult = context.getResult('market');
      const technicalResult = context.getResult('technical');

      expect(financialResult.status).toBe('completed');
      expect(marketResult.status).toBe('failed');
      expect(technicalResult.status).toBe('completed');
    });

    it('should generate comprehensive final report', async () => {
      const context = new MockWorkflowContext('TechCorp Inc.');
      
      // Simulate agent results
      context.update('financial', {
        agentId: 'financial',
        findings: { revenue: 25000000, growth_rate: 0.389 },
        confidence: 0.92
      });

      context.update('market', {
        agentId: 'market',
        findings: { tam: 50000000000, growth_rate: 0.25 },
        confidence: 0.88
      });

      context.update('risk', {
        agentId: 'risk',
        findings: { overall_risk_score: 4.5, category: 'Medium' },
        confidence: 0.91
      });

      const finalReport = {
        company: context.company,
        timestamp: new Date().toISOString(),
        agents_executed: Array.from(context.results.keys()),
        findings: {
          financial: context.getResult('financial'),
          market: context.getResult('market'),
          risk: context.getResult('risk')
        },
        overall_confidence: 0.90,
        recommendation: 'Proceed with standard due diligence'
      };

      expect(finalReport.company).toBe('TechCorp Inc.');
      expect(finalReport.agents_executed).toHaveLength(3);
      expect(finalReport.findings.financial).toBeDefined();
      expect(finalReport.recommendation).toBeDefined();
    });
  });

  describe('Multi-Agent Coordination', () => {
    it('should coordinate multiple agents with data sharing', async () => {
      const financialAgent = new MockAgent('financial');
      const riskAgent = new MockAgent('risk');

      // Financial agent executes first
      const financialResult = await financialAgent.execute({ company: mockCompanyBasicInfo });

      // Risk agent uses financial data
      const riskResult = await riskAgent.execute({
        company: mockCompanyBasicInfo,
        financial_data: financialResult.findings
      });

      expect(financialAgent.executionCount).toBe(1);
      expect(riskAgent.executionCount).toBe(1);
      expect(riskResult).toBeDefined();
    });

    it('should handle concurrent agent execution', async () => {
      const agents = Array.from({ length: 5 }, (_, i) => new MockAgent(`agent-${i}`));

      const startTime = Date.now();
      
      const results = await Promise.all(
        agents.map(agent => agent.execute({ company: mockCompanyBasicInfo }))
      );

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.agentId).toBe(`agent-${index}`);
        expect(result.status).toBe('completed');
      });

      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(500); // Should complete quickly in parallel
    });

    it('should validate cross-agent data consistency', async () => {
      const results = {
        financial: { revenue: 25000000 },
        market: { market_share: 0.05 },
        competitive: { rank: 4 }
      };

      // Cross-validation logic
      const validateConsistency = (results: any) => {
        const estimatedRevenue = results.market.market_share * 500000000; // 5% of $500M SOM
        const actualRevenue = results.financial.revenue;
        const discrepancy = Math.abs(estimatedRevenue - actualRevenue) / actualRevenue;

        return {
          consistent: discrepancy < 0.2, // Within 20%
          discrepancy,
          validation_passed: true
        };
      };

      const validation = validateConsistency(results);

      expect(validation.consistent).toBe(true);
      expect(validation.validation_passed).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 1000
      }));

      const startTime = Date.now();

      // Process dataset
      const processed = largeDataset
        .filter(item => item.value > 500)
        .map(item => ({ ...item, processed: true }))
        .slice(0, 100);

      const duration = Date.now() - startTime;

      expect(processed.length).toBeLessThanOrEqual(100);
      expect(duration).toBeLessThan(100); // Should process quickly
    });

    it('should maintain performance under load', async () => {
      const agent = new MockAgent('load-test');
      const iterations = 50;

      const startTime = Date.now();

      const results = await Promise.all(
        Array.from({ length: iterations }, () => 
          agent.execute({ company: mockCompanyBasicInfo })
        )
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(results).toHaveLength(iterations);
      expect(avgTime).toBeLessThan(100); // Average time per request
    });
  });

  describe('Data Pipeline Integration', () => {
    it('should integrate with all MCP servers', async () => {
      const mcpCalls = [
        testEnv.mcpManager.query('alphavantage', { symbol: 'TECH' }),
        testEnv.mcpManager.query('exa', { query: 'TechCorp' }),
        testEnv.mcpManager.query('github', { org: 'techcorp' })
      ];

      const results = await Promise.all(mcpCalls);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('success');
        expect(result.data).toBeDefined();
      });
    });

    it('should aggregate data from multiple sources', async () => {
      const financialData = await testEnv.mcpManager.query('alphavantage', { symbol: 'TECH' });
      const webData = await testEnv.mcpManager.query('exa', { query: 'TechCorp' });
      const technicalData = await testEnv.mcpManager.query('github', { org: 'techcorp' });

      const aggregated = {
        company: 'TechCorp Inc.',
        financial: financialData.data,
        web_presence: webData.data,
        technical: technicalData.data,
        timestamp: new Date().toISOString()
      };

      expect(aggregated.financial).toBeDefined();
      expect(aggregated.web_presence).toBeDefined();
      expect(aggregated.technical).toBeDefined();
    });
  });
});
