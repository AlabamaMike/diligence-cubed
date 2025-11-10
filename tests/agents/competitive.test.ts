/**
 * Tests for Competitive Intelligence Agent
 */

import { createTestEnvironment } from '../helpers/test-utils';
import { mockCompetitiveAnalysis } from '../fixtures/company-data';

describe('CompetitiveAgent', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let competitiveAgent: any;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    
    competitiveAgent = {
      mapCompetitors: jest.fn(),
      analyzePositioning: jest.fn(),
      assessMoat: jest.fn(),
      identifyThreats: jest.fn(),
      execute: jest.fn()
    };
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('mapCompetitors', () => {
    it('should identify direct competitors', async () => {
      competitiveAgent.mapCompetitors.mockResolvedValue({
        direct_competitors: [
          { name: 'Competitor A', market_share: 0.25, revenue: 100000000 },
          { name: 'Competitor B', market_share: 0.18, revenue: 75000000 }
        ],
        indirect_competitors: ['Alternative Provider'],
        total_mapped: 8
      });

      const mapping = await competitiveAgent.mapCompetitors(mockCompetitiveAnalysis);

      expect(mapping.direct_competitors.length).toBeGreaterThan(0);
      expect(mapping.total_mapped).toBeGreaterThan(0);
    });
  });

  describe('assessMoat', () => {
    it('should evaluate competitive advantages', async () => {
      competitiveAgent.assessMoat.mockResolvedValue({
        network_effects: 7,
        switching_costs: 8,
        brand_strength: 6,
        regulatory_advantages: 4,
        overall_moat_score: 6.25,
        moat_category: 'Narrow moat'
      });

      const moat = await competitiveAgent.assessMoat(mockCompetitiveAnalysis);

      expect(moat.overall_moat_score).toBeWithinRange(0, 10);
      expect(moat.moat_category).toBeDefined();
    });
  });
});
