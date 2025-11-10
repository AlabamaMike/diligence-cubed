/**
 * Multi-Agent Coordination Tests
 */

import { MockAgent, MockWorkflowContext } from '../helpers/mocks';
import { createTestEnvironment } from '../helpers/test-utils';
import { mockCompanyBasicInfo } from '../fixtures/company-data';

describe('Multi-Agent Coordination', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('Agent Communication', () => {
    it('should pass data between agents', async () => {
      const financialAgent = new MockAgent('financial');
      const riskAgent = new MockAgent('risk');

      const financialResult = await financialAgent.execute({ company: mockCompanyBasicInfo });
      const riskResult = await riskAgent.execute({
        company: mockCompanyBasicInfo,
        financial_data: financialResult.findings
      });

      expect(riskResult).toBeDefined();
      expect(riskResult.status).toBe('completed');
    });

    it('should handle agent failures without blocking others', async () => {
      const agents = [
        new MockAgent('agent-1'),
        new MockAgent('agent-2'),
        new MockAgent('agent-3')
      ];

      agents[1].setShouldFail(true);

      const results = await Promise.allSettled(
        agents.map(agent => agent.execute({ company: mockCompanyBasicInfo }))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should synchronize agent execution', async () => {
      const context = new MockWorkflowContext('TechCorp Inc.');
      const agents = Array.from({ length: 3 }, (_, i) => new MockAgent(`agent-${i}`));

      for (const agent of agents) {
        const result = await agent.execute({ company: mockCompanyBasicInfo });
        context.update(agent.name, result);
      }

      expect(context.results.size).toBe(3);
      agents.forEach(agent => {
        expect(context.getResult(agent.name)).toBeDefined();
      });
    });
  });

  describe('Cross-Validation', () => {
    it('should validate consistency across agents', async () => {
      const results = {
        financial: { revenue: 25000000, growth_rate: 0.389 },
        market: { tam: 50000000000, som: 500000000 },
        customer: { total_customers: 450, avg_contract_value: 55555 }
      };

      // Cross-validation: Check if revenue matches customer data
      const estimatedRevenue = results.customer.total_customers * results.customer.avg_contract_value;
      const actualRevenue = results.financial.revenue;
      const discrepancy = Math.abs(estimatedRevenue - actualRevenue) / actualRevenue;

      expect(discrepancy).toBeLessThan(0.1); // Within 10%
    });

    it('should identify conflicting data points', async () => {
      const results = {
        agent1: { market_share: 0.10 },
        agent2: { market_share: 0.05 }
      };

      const conflicts = [];
      
      if (results.agent1.market_share !== results.agent2.market_share) {
        conflicts.push({
          field: 'market_share',
          values: [results.agent1.market_share, results.agent2.market_share],
          agents: ['agent1', 'agent2']
        });
      }

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].field).toBe('market_share');
    });
  });

  describe('Workflow State Management', () => {
    it('should maintain workflow state', async () => {
      const context = new MockWorkflowContext('TechCorp Inc.');

      context.setStage('discovery');
      expect(context.stage).toBe('discovery');

      context.setStage('research');
      expect(context.stage).toBe('research');

      context.setStage('synthesis');
      expect(context.stage).toBe('synthesis');
    });

    it('should track agent completion status', async () => {
      const context = new MockWorkflowContext('TechCorp Inc.');
      const agents = ['financial', 'market', 'competitive'];

      agents.forEach(agentId => {
        context.update(agentId, { status: 'completed', findings: {} });
      });

      expect(context.results.size).toBe(3);
      expect(Array.from(context.results.keys())).toEqual(agents);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate critical errors', async () => {
      const agent = new MockAgent('critical-agent');
      agent.setShouldFail(true);

      await expect(
        agent.execute({ company: mockCompanyBasicInfo })
      ).rejects.toThrow('Agent critical-agent execution failed');
    });

    it('should handle non-critical errors gracefully', async () => {
      const context = new MockWorkflowContext('TechCorp Inc.');
      const agent = new MockAgent('non-critical');

      try {
        agent.setShouldFail(true);
        await agent.execute({ company: mockCompanyBasicInfo });
      } catch (error) {
        context.update('non-critical', {
          status: 'failed',
          error: (error as Error).message,
          graceful_degradation: true
        });
      }

      const result = context.getResult('non-critical');
      expect(result.status).toBe('failed');
      expect(result.graceful_degradation).toBe(true);
    });
  });
});
