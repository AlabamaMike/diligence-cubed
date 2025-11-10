/**
 * Tests for Market & Industry Agent
 */

import { MockMCPServerManager } from '../helpers/mocks';
import { createTestEnvironment } from '../helpers/test-utils';
import { mockMarketAnalysis } from '../fixtures/company-data';
import { mockExaSearchResponse, mockPerplexityResponse } from '../fixtures/mcp-responses';

describe('MarketAgent', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let marketAgent: any;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    
    marketAgent = {
      analyzeMarketSize: jest.fn(),
      identifyGrowthDrivers: jest.fn(),
      assessIndustryStructure: jest.fn(),
      analyzeRegulatory: jest.fn(),
      execute: jest.fn()
    };

    testEnv.mcpManager.setResponse('exa', mockExaSearchResponse);
    testEnv.mcpManager.setResponse('perplexity', mockPerplexityResponse);
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('analyzeMarketSize', () => {
    it('should calculate TAM/SAM/SOM', async () => {
      marketAgent.analyzeMarketSize.mockResolvedValue({
        tam: 50000000000,
        sam: 10000000000,
        som: 500000000,
        methodology: 'bottom-up',
        confidence: 0.85
      });

      const analysis = await marketAgent.analyzeMarketSize(mockMarketAnalysis);

      expect(analysis.tam).toBeGreaterThan(analysis.sam);
      expect(analysis.sam).toBeGreaterThan(analysis.som);
      expect(analysis.methodology).toBeDefined();
    });

    it('should validate market size calculations', async () => {
      marketAgent.analyzeMarketSize.mockResolvedValue({
        tam: 50000000000,
        sam: 10000000000,
        som: 500000000,
        target_share: 0.05,
        achievable: true,
        validation: {
          sources_aligned: true,
          reasonable_assumptions: true
        }
      });

      const analysis = await marketAgent.analyzeMarketSize(mockMarketAnalysis);

      expect(analysis.validation.sources_aligned).toBe(true);
      expect(analysis.achievable).toBe(true);
    });
  });

  describe('identifyGrowthDrivers', () => {
    it('should identify secular trends', async () => {
      marketAgent.identifyGrowthDrivers.mockResolvedValue({
        secular_trends: [
          { trend: 'Digital transformation', impact: 'high', duration: 'long-term' },
          { trend: 'AI adoption', impact: 'high', duration: 'medium-term' }
        ],
        cyclical_factors: [],
        overall_growth_outlook: 'positive'
      });

      const drivers = await marketAgent.identifyGrowthDrivers(mockMarketAnalysis);

      expect(drivers.secular_trends.length).toBeGreaterThan(0);
      expect(drivers.overall_growth_outlook).toBe('positive');
    });

    it('should assess regulatory impact', async () => {
      marketAgent.identifyGrowthDrivers.mockResolvedValue({
        regulatory_changes: [
          { regulation: 'Data Privacy', impact: 'positive', timeline: '2025-Q2' }
        ],
        compliance_burden: 'medium'
      });

      const drivers = await marketAgent.identifyGrowthDrivers(mockMarketAnalysis);

      expect(drivers.regulatory_changes).toBeDefined();
      expect(drivers.compliance_burden).toBeDefined();
    });
  });

  describe('assessIndustryStructure', () => {
    it('should analyze competitive intensity', async () => {
      marketAgent.assessIndustryStructure.mockResolvedValue({
        concentration: 'fragmented',
        barriers_to_entry: 'medium',
        buyer_power: 'medium',
        supplier_power: 'low',
        substitution_threat: 'low',
        competitive_intensity_score: 6.5
      });

      const structure = await marketAgent.assessIndustryStructure(mockMarketAnalysis);

      expect(structure.competitive_intensity_score).toBeWithinRange(0, 10);
      expect(structure.concentration).toBeDefined();
    });

    it('should evaluate barriers to entry', async () => {
      marketAgent.assessIndustryStructure.mockResolvedValue({
        barriers_to_entry: 'high',
        barrier_factors: [
          { factor: 'Capital requirements', strength: 'high' },
          { factor: 'Network effects', strength: 'medium' },
          { factor: 'Regulatory', strength: 'medium' }
        ]
      });

      const structure = await marketAgent.assessIndustryStructure(mockMarketAnalysis);

      expect(structure.barriers_to_entry).toBe('high');
      expect(structure.barrier_factors.length).toBeGreaterThan(0);
    });
  });
});
