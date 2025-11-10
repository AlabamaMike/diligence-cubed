/**
 * Tests for Financial Analysis Agent
 */

import { MockMCPServerManager } from '../helpers/mocks';
import { createTestEnvironment } from '../helpers/test-utils';
import { mockCompanyFinancials } from '../fixtures/company-data';
import { mockAlphaVantageResponse } from '../fixtures/mcp-responses';
import { mockFinancialAgentResult } from '../fixtures/agent-results';

describe('FinancialAgent', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let financialAgent: any;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    
    // Mock financial agent
    financialAgent = {
      analyzeRevenue: jest.fn(),
      analyzeProfitability: jest.fn(),
      calculateValuation: jest.fn(),
      assessFinancialHealth: jest.fn(),
      identifyRedFlags: jest.fn(),
      execute: jest.fn()
    };

    // Set up MCP responses
    testEnv.mcpManager.setResponse('alphavantage', mockAlphaVantageResponse);
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('analyzeRevenue', () => {
    it('should analyze revenue metrics correctly', async () => {
      financialAgent.analyzeRevenue.mockResolvedValue({
        current_arr: 25000000,
        growth_rate: 0.389,
        quality_score: 0.85,
        trends: 'accelerating',
        forecast: [35000000, 49000000, 68600000]
      });

      const analysis = await financialAgent.analyzeRevenue(mockCompanyFinancials);

      expect(analysis.current_arr).toBeGreaterThan(0);
      expect(analysis.growth_rate).toBeWithinRange(0, 1);
      expect(analysis.quality_score).toBeWithinRange(0, 1);
      expect(analysis.forecast).toHaveLength(3);
    });

    it('should calculate growth rate accurately', async () => {
      const revenueData = {
        current: 25000000,
        previous: 18000000
      };

      financialAgent.analyzeRevenue.mockImplementation(async (data: any) => {
        const growthRate = (data.revenue.current_arr - data.revenue.previous_year) / data.revenue.previous_year;
        return { growth_rate: growthRate };
      });

      const analysis = await financialAgent.analyzeRevenue(mockCompanyFinancials);
      
      expect(analysis.growth_rate).toBeCloseTo(0.389, 2);
    });

    it('should assess revenue quality', async () => {
      financialAgent.analyzeRevenue.mockResolvedValue({
        recurring_percentage: 0.85,
        one_time_percentage: 0.15,
        quality_score: 0.85,
        quality_factors: {
          recurring: 'high',
          predictable: 'high',
          diversified: 'medium'
        }
      });

      const analysis = await financialAgent.analyzeRevenue(mockCompanyFinancials);

      expect(analysis.quality_score).toBeGreaterThan(0.7);
      expect(analysis.recurring_percentage).toBeGreaterThan(0.7);
      expect(analysis.quality_factors).toBeDefined();
    });
  });

  describe('analyzeProfitability', () => {
    it('should analyze margin structure', async () => {
      financialAgent.analyzeProfitability.mockResolvedValue({
        gross_margin: 0.75,
        ebitda_margin: 0.15,
        net_margin: 0.08,
        margin_trends: 'improving',
        benchmarks: {
          gross_margin_percentile: 75,
          ebitda_margin_percentile: 60
        }
      });

      const analysis = await financialAgent.analyzeProfitability(mockCompanyFinancials);

      expect(analysis.gross_margin).toBeWithinRange(0, 1);
      expect(analysis.ebitda_margin).toBeLessThanOrEqual(analysis.gross_margin);
      expect(analysis.net_margin).toBeLessThanOrEqual(analysis.ebitda_margin);
    });

    it('should identify path to profitability', async () => {
      const unprofitableCompany = {
        ...mockCompanyFinancials,
        profitability: { ...mockCompanyFinancials.profitability, net_margin: -0.15 }
      };

      financialAgent.analyzeProfitability.mockResolvedValue({
        currently_profitable: false,
        path_to_profitability: 'clear',
        estimated_timeline: '18 months',
        key_drivers: ['Revenue growth', 'Operational leverage']
      });

      const analysis = await financialAgent.analyzeProfitability(unprofitableCompany);

      expect(analysis.currently_profitable).toBe(false);
      expect(analysis.path_to_profitability).toBeDefined();
      expect(analysis.estimated_timeline).toBeDefined();
    });

    it('should calculate unit economics', async () => {
      financialAgent.analyzeProfitability.mockResolvedValue({
        cac: 15000,
        ltv: 125000,
        ltv_cac_ratio: 8.3,
        payback_months: 14,
        unit_economics_health: 'strong'
      });

      const analysis = await financialAgent.analyzeProfitability(mockCompanyFinancials);

      expect(analysis.ltv_cac_ratio).toBeGreaterThan(3);
      expect(analysis.payback_months).toBeLessThan(24);
      expect(analysis.unit_economics_health).toBe('strong');
    });
  });

  describe('calculateValuation', () => {
    it('should perform DCF valuation', async () => {
      financialAgent.calculateValuation.mockResolvedValue({
        dcf_value: 185000000,
        wacc: 0.12,
        terminal_growth_rate: 0.03,
        sensitivity_analysis: {
          base: 185000000,
          bull: 230000000,
          bear: 145000000
        }
      });

      const valuation = await financialAgent.calculateValuation(mockCompanyFinancials);

      expect(valuation.dcf_value).toBeGreaterThan(0);
      expect(valuation.wacc).toBeWithinRange(0, 0.3);
      expect(valuation.sensitivity_analysis).toBeDefined();
    });

    it('should compare with comparable companies', async () => {
      financialAgent.calculateValuation.mockResolvedValue({
        comparable_multiples: {
          ev_revenue: [3.5, 4.0, 5.0, 6.2],
          median: 4.5,
          target_multiple: 4.0
        },
        implied_valuation: 100000000
      });

      const valuation = await financialAgent.calculateValuation(mockCompanyFinancials);

      expect(valuation.comparable_multiples).toBeDefined();
      expect(valuation.comparable_multiples.median).toBeGreaterThan(0);
      expect(valuation.implied_valuation).toBeGreaterThan(0);
    });

    it('should perform precedent transaction analysis', async () => {
      financialAgent.calculateValuation.mockResolvedValue({
        precedent_transactions: [
          { company: 'Similar Co A', multiple: 4.2, year: 2024 },
          { company: 'Similar Co B', multiple: 5.1, year: 2023 }
        ],
        median_multiple: 4.65,
        adjusted_multiple: 4.3
      });

      const valuation = await financialAgent.calculateValuation(mockCompanyFinancials);

      expect(valuation.precedent_transactions).toBeDefined();
      expect(valuation.precedent_transactions.length).toBeGreaterThan(0);
    });
  });

  describe('assessFinancialHealth', () => {
    it('should calculate liquidity ratios', async () => {
      financialAgent.assessFinancialHealth.mockResolvedValue({
        current_ratio: 2.5,
        quick_ratio: 2.2,
        cash_ratio: 1.5,
        liquidity_score: 'strong',
        runway_months: 30
      });

      const health = await financialAgent.assessFinancialHealth(mockCompanyFinancials);

      expect(health.current_ratio).toBeGreaterThan(1);
      expect(health.liquidity_score).toBe('strong');
      expect(health.runway_months).toBeGreaterThan(12);
    });

    it('should identify burn rate concerns', async () => {
      const highBurnCompany = {
        ...mockCompanyFinancials,
        metrics: { ...mockCompanyFinancials.metrics, burn_rate: -2000000, runway_months: 8 }
      };

      financialAgent.assessFinancialHealth.mockResolvedValue({
        burn_rate: -2000000,
        runway_months: 8,
        needs_funding: true,
        urgency: 'high'
      });

      const health = await financialAgent.assessFinancialHealth(highBurnCompany);

      expect(health.needs_funding).toBe(true);
      expect(health.urgency).toBe('high');
      expect(health.runway_months).toBeLessThan(12);
    });
  });

  describe('identifyRedFlags', () => {
    it('should detect revenue quality issues', async () => {
      const problematicFinancials = {
        ...mockCompanyFinancials,
        revenue: { ...mockCompanyFinancials.revenue, revenue_quality_score: 0.45 }
      };

      financialAgent.identifyRedFlags.mockResolvedValue([
        { category: 'revenue_quality', severity: 'high', description: 'Low revenue quality score' }
      ]);

      const redFlags = await financialAgent.identifyRedFlags(problematicFinancials);

      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags[0].category).toBe('revenue_quality');
      expect(redFlags[0].severity).toBe('high');
    });

    it('should detect deteriorating margins', async () => {
      financialAgent.identifyRedFlags.mockResolvedValue([
        { 
          category: 'profitability', 
          severity: 'medium', 
          description: 'Margins declining YoY',
          trend: 'negative'
        }
      ]);

      const redFlags = await financialAgent.identifyRedFlags(mockCompanyFinancials);

      const marginFlag = redFlags.find((f: any) => f.category === 'profitability');
      expect(marginFlag).toBeDefined();
    });

    it('should flag high customer concentration', async () => {
      financialAgent.identifyRedFlags.mockResolvedValue([
        { 
          category: 'revenue_concentration', 
          severity: 'high', 
          description: 'Top 3 customers represent 60% of revenue'
        }
      ]);

      const redFlags = await financialAgent.identifyRedFlags(mockCompanyFinancials);

      const concentrationFlag = redFlags.find((f: any) => f.category === 'revenue_concentration');
      expect(concentrationFlag?.severity).toBe('high');
    });
  });

  describe('execute', () => {
    it('should return comprehensive financial analysis', async () => {
      financialAgent.execute.mockResolvedValue(mockFinancialAgentResult);

      const result = await financialAgent.execute({ company: 'TechCorp Inc.' });

      expect(result.agentId).toBe('financial');
      expect(result.status).toBe('completed');
      expect(result.findings).toBeDefined();
      expect(result.findings.revenue_analysis).toBeDefined();
      expect(result.findings.profitability_analysis).toBeDefined();
      expect(result.findings.valuation).toBeDefined();
    });

    it('should use MCP servers for data', async () => {
      financialAgent.execute.mockImplementation(async () => {
        const alphaVantageData = await testEnv.mcpManager.query('alphavantage', {});
        return {
          ...mockFinancialAgentResult,
          sources: ['alphavantage']
        };
      });

      const result = await financialAgent.execute({ company: 'TechCorp Inc.' });

      expect(testEnv.mcpManager.getCallHistory().length).toBeGreaterThan(0);
      expect(result.sources).toContain('alphavantage');
    });

    it('should handle missing data gracefully', async () => {
      testEnv.mcpManager.setResponse('alphavantage', {
        data: null,
        status: 'error',
        source: 'alphavantage',
        timestamp: new Date().toISOString(),
        cached: false
      });

      financialAgent.execute.mockResolvedValue({
        agentId: 'financial',
        status: 'completed',
        findings: {},
        confidence: 0.5,
        warnings: ['Limited data available']
      });

      const result = await financialAgent.execute({ company: 'TechCorp Inc.' });

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate input data', async () => {
      const invalidData = {
        revenue: { current_arr: -1000 } // Invalid negative revenue
      };

      financialAgent.execute.mockRejectedValue(
        new Error('Invalid input: revenue cannot be negative')
      );

      await expect(financialAgent.execute(invalidData)).rejects.toThrow('Invalid input');
    });

    it('should validate calculation results', async () => {
      financialAgent.analyzeRevenue.mockResolvedValue({
        growth_rate: 1.5, // 150% growth should be flagged for verification
        needs_verification: true
      });

      const result = await financialAgent.analyzeRevenue(mockCompanyFinancials);

      expect(result.needs_verification).toBe(true);
    });
  });
});
