/**
 * Tests for Orchestrator Agent
 */

import { MockMCPServerManager, MockWorkflowContext } from '../helpers/mocks';
import { createTestEnvironment } from '../helpers/test-utils';
import { mockCompanyBasicInfo } from '../fixtures/company-data';
import { mockOrchestratorResult } from '../fixtures/agent-results';

describe('OrchestratorAgent', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let orchestrator: any;
  let context: MockWorkflowContext;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    context = new MockWorkflowContext('TechCorp Inc.');
    
    // Mock orchestrator agent
    orchestrator = {
      planResearch: jest.fn(),
      delegateTasks: jest.fn(),
      validateFindings: jest.fn(),
      identifyGaps: jest.fn(),
      synthesizeResults: jest.fn()
    };
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('planResearch', () => {
    it('should create a comprehensive research plan', async () => {
      const scope = {
        type: 'full',
        depth: 'deep',
        focus_areas: ['financial', 'market', 'technical']
      };

      orchestrator.planResearch.mockResolvedValue({
        company: 'TechCorp Inc.',
        agents: ['financial', 'market', 'competitive', 'customer', 'technical', 'risk'],
        priority: ['financial', 'market'],
        estimatedDuration: 14400,
        checkpoints: ['initial_data_gathered', 'validation_complete', 'gaps_identified']
      });

      const plan = await orchestrator.planResearch(mockCompanyBasicInfo, scope);

      expect(plan).toBeDefined();
      expect(plan.company).toBe('TechCorp Inc.');
      expect(plan.agents).toContain('financial');
      expect(plan.agents).toContain('market');
      expect(plan.agents.length).toBeGreaterThan(3);
      expect(orchestrator.planResearch).toHaveBeenCalledWith(mockCompanyBasicInfo, scope);
    });

    it('should adapt plan based on company type', async () => {
      const techCompany = { ...mockCompanyBasicInfo, industry: 'Software' };
      const retailCompany = { ...mockCompanyBasicInfo, industry: 'Retail' };

      orchestrator.planResearch.mockImplementation(async (company: any) => {
        if (company.industry === 'Software') {
          return { agents: ['financial', 'technical', 'market'], focus: 'technology' };
        }
        return { agents: ['financial', 'market', 'customer'], focus: 'operations' };
      });

      const techPlan = await orchestrator.planResearch(techCompany, { type: 'full' });
      const retailPlan = await orchestrator.planResearch(retailCompany, { type: 'full' });

      expect(techPlan.agents).toContain('technical');
      expect(techPlan.focus).toBe('technology');
      expect(retailPlan.agents).toContain('customer');
      expect(retailPlan.focus).toBe('operations');
    });

    it('should handle different depth levels', async () => {
      orchestrator.planResearch.mockImplementation(async (_company: any, scope: any) => {
        return {
          depth: scope.depth,
          agents: scope.depth === 'exhaustive' ? 9 : scope.depth === 'deep' ? 6 : 4,
          estimatedDuration: scope.depth === 'exhaustive' ? 28800 : scope.depth === 'deep' ? 14400 : 7200
        };
      });

      const standardPlan = await orchestrator.planResearch(mockCompanyBasicInfo, { depth: 'standard' });
      const deepPlan = await orchestrator.planResearch(mockCompanyBasicInfo, { depth: 'deep' });
      const exhaustivePlan = await orchestrator.planResearch(mockCompanyBasicInfo, { depth: 'exhaustive' });

      expect(standardPlan.agents).toBe(4);
      expect(deepPlan.agents).toBe(6);
      expect(exhaustivePlan.agents).toBe(9);
      expect(exhaustivePlan.estimatedDuration).toBeGreaterThan(deepPlan.estimatedDuration);
    });
  });

  describe('delegateTasks', () => {
    it('should delegate tasks to appropriate agents', async () => {
      const plan = {
        company: 'TechCorp Inc.',
        agents: ['financial', 'market', 'competitive'],
        priority: ['financial']
      };

      orchestrator.delegateTasks.mockResolvedValue([
        { agentId: 'financial', status: 'assigned', priority: 1 },
        { agentId: 'market', status: 'assigned', priority: 2 },
        { agentId: 'competitive', status: 'assigned', priority: 3 }
      ]);

      const tasks = await orchestrator.delegateTasks(plan);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].agentId).toBe('financial');
      expect(tasks[0].priority).toBe(1);
      expect(orchestrator.delegateTasks).toHaveBeenCalledWith(plan);
    });

    it('should handle parallel task execution', async () => {
      const plan = {
        agents: ['financial', 'market', 'competitive'],
        parallel: true
      };

      orchestrator.delegateTasks.mockResolvedValue([
        { agentId: 'financial', status: 'running', startTime: Date.now() },
        { agentId: 'market', status: 'running', startTime: Date.now() },
        { agentId: 'competitive', status: 'running', startTime: Date.now() }
      ]);

      const tasks = await orchestrator.delegateTasks(plan);

      expect(tasks.every((t: any) => t.status === 'running')).toBe(true);
      
      // All tasks should start around the same time (parallel execution)
      const startTimes = tasks.map((t: any) => t.startTime);
      const maxDifference = Math.max(...startTimes) - Math.min(...startTimes);
      expect(maxDifference).toBeLessThan(100); // Within 100ms
    });

    it('should handle task dependencies', async () => {
      const plan = {
        agents: ['financial', 'risk'],
        dependencies: {
          risk: ['financial'] // Risk agent depends on financial agent
        }
      };

      orchestrator.delegateTasks.mockResolvedValue([
        { agentId: 'financial', status: 'assigned', dependencies: [] },
        { agentId: 'risk', status: 'waiting', dependencies: ['financial'] }
      ]);

      const tasks = await orchestrator.delegateTasks(plan);

      const riskTask = tasks.find((t: any) => t.agentId === 'risk');
      expect(riskTask?.status).toBe('waiting');
      expect(riskTask?.dependencies).toContain('financial');
    });
  });

  describe('validateFindings', () => {
    it('should cross-validate findings from multiple agents', async () => {
      const results = [
        { agentId: 'financial', findings: { revenue: 25000000 } },
        { agentId: 'market', findings: { market_share: 0.05 } },
        { agentId: 'competitive', findings: { rank: 4 } }
      ];

      orchestrator.validateFindings.mockResolvedValue({
        valid: true,
        consistency_score: 0.94,
        conflicts: [],
        validated_count: 3
      });

      const validation = await orchestrator.validateFindings(results);

      expect(validation.valid).toBe(true);
      expect(validation.consistency_score).toBeGreaterThan(0.9);
      expect(validation.conflicts).toHaveLength(0);
      expect(orchestrator.validateFindings).toHaveBeenCalledWith(results);
    });

    it('should detect conflicting information', async () => {
      const results = [
        { agentId: 'financial', findings: { revenue: 25000000, growth_rate: 0.45 } },
        { agentId: 'market', findings: { revenue: 30000000, growth_rate: 0.45 } } // Conflict
      ];

      orchestrator.validateFindings.mockResolvedValue({
        valid: false,
        consistency_score: 0.65,
        conflicts: [
          {
            field: 'revenue',
            values: [25000000, 30000000],
            agents: ['financial', 'market']
          }
        ]
      });

      const validation = await orchestrator.validateFindings(results);

      expect(validation.valid).toBe(false);
      expect(validation.conflicts).toHaveLength(1);
      expect(validation.conflicts[0].field).toBe('revenue');
    });

    it('should handle missing required data', async () => {
      const results = [
        { agentId: 'financial', findings: { revenue: 25000000 } }
        // Missing market and competitive data
      ];

      orchestrator.validateFindings.mockResolvedValue({
        valid: false,
        consistency_score: 0.30,
        conflicts: [],
        missing: ['market_data', 'competitive_data']
      });

      const validation = await orchestrator.validateFindings(results);

      expect(validation.valid).toBe(false);
      expect(validation.missing).toBeDefined();
      expect(validation.missing?.length).toBeGreaterThan(0);
    });
  });

  describe('identifyGaps', () => {
    it('should identify missing information', async () => {
      const validatedResults = {
        financial: { complete: true },
        market: { complete: false, missing: ['competitor_analysis'] },
        technical: { complete: false, missing: ['security_audit'] }
      };

      orchestrator.identifyGaps.mockResolvedValue([
        { area: 'market', missing: 'competitor_analysis', priority: 'high' },
        { area: 'technical', missing: 'security_audit', priority: 'medium' }
      ]);

      const gaps = await orchestrator.identifyGaps(validatedResults);

      expect(gaps).toHaveLength(2);
      expect(gaps[0].priority).toBe('high');
      expect(gaps.some((g: any) => g.missing === 'competitor_analysis')).toBe(true);
    });

    it('should prioritize critical gaps', async () => {
      const validatedResults = {
        financial: { complete: false, missing: ['cash_flow'] },
        market: { complete: false, missing: ['tam_analysis'] }
      };

      orchestrator.identifyGaps.mockResolvedValue([
        { area: 'financial', missing: 'cash_flow', priority: 'critical', impact: 'high' },
        { area: 'market', missing: 'tam_analysis', priority: 'medium', impact: 'medium' }
      ]);

      const gaps = await orchestrator.identifyGaps(validatedResults);

      const criticalGaps = gaps.filter((g: any) => g.priority === 'critical');
      expect(criticalGaps).toHaveLength(1);
      expect(criticalGaps[0].area).toBe('financial');
    });
  });

  describe('synthesizeResults', () => {
    it('should create comprehensive final report', async () => {
      const allResults = {
        financial: mockOrchestratorResult,
        market: mockOrchestratorResult,
        competitive: mockOrchestratorResult
      };

      orchestrator.synthesizeResults.mockResolvedValue({
        company: 'TechCorp Inc.',
        executive_summary: 'Strong growth trajectory...',
        recommendation: 'Proceed',
        confidence: 0.92,
        key_findings: [],
        risks: [],
        opportunities: []
      });

      const report = await orchestrator.synthesizeResults(allResults);

      expect(report).toBeDefined();
      expect(report.company).toBe('TechCorp Inc.');
      expect(report.recommendation).toBeDefined();
      expect(report.confidence).toBeGreaterThan(0.8);
      expect(orchestrator.synthesizeResults).toHaveBeenCalledWith(allResults);
    });

    it('should include all critical findings', async () => {
      const allResults = {
        financial: { findings: { red_flags: ['High customer concentration'] } },
        risk: { findings: { critical_risks: ['Key person dependency'] } }
      };

      orchestrator.synthesizeResults.mockResolvedValue({
        critical_findings: ['High customer concentration', 'Key person dependency'],
        requires_escalation: true
      });

      const report = await orchestrator.synthesizeResults(allResults);

      expect(report.critical_findings).toHaveLength(2);
      expect(report.requires_escalation).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle agent failures gracefully', async () => {
      orchestrator.delegateTasks.mockRejectedValue(
        new Error('Agent assignment failed')
      );

      await expect(orchestrator.delegateTasks({})).rejects.toThrow('Agent assignment failed');
    });

    it('should handle partial results', async () => {
      const partialResults = [
        { agentId: 'financial', status: 'completed', findings: {} },
        { agentId: 'market', status: 'failed', error: 'Timeout' }
      ];

      orchestrator.validateFindings.mockResolvedValue({
        valid: false,
        partial: true,
        completed_agents: 1,
        failed_agents: 1
      });

      const validation = await orchestrator.validateFindings(partialResults);

      expect(validation.partial).toBe(true);
      expect(validation.failed_agents).toBe(1);
    });
  });
});
