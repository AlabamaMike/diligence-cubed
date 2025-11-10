/**
 * Test fixtures for agent results
 */

export const mockOrchestratorResult = {
  agentId: 'orchestrator',
  status: 'completed' as const,
  findings: {
    research_plan: {
      company: 'TechCorp Inc.',
      scope: 'full',
      depth: 'deep',
      agents_assigned: [
        'financial',
        'market',
        'competitive',
        'customer',
        'technical',
        'risk'
      ],
      estimated_duration: '4 hours',
      priority_areas: [
        'Financial health',
        'Market positioning',
        'Technical capabilities'
      ]
    },
    validation_results: {
      cross_check_passed: true,
      consistency_score: 0.94,
      conflicts: [],
      gaps: ['Limited historical data for customer cohort analysis']
    }
  },
  confidence: 0.95,
  sources: ['internal_analysis'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockFinancialAgentResult = {
  agentId: 'financial',
  status: 'completed' as const,
  findings: {
    revenue_analysis: {
      current_arr: 25000000,
      growth_rate: 0.389,
      quality_score: 0.85,
      trends: 'Accelerating growth',
      forecast: {
        year_1: 35000000,
        year_2: 49000000,
        year_3: 68600000
      }
    },
    profitability_analysis: {
      gross_margin: 0.75,
      ebitda_margin: 0.15,
      path_to_profitability: 'Clear within 18 months',
      margin_expansion_potential: 'High'
    },
    valuation: {
      dcf_value: 185000000,
      comparable_companies_range: [150000000, 220000000],
      precedent_transactions_range: [170000000, 210000000],
      recommended_valuation: 190000000
    },
    red_flags: [],
    opportunities: [
      'Strong unit economics',
      'Improving margins',
      'High growth rate'
    ]
  },
  confidence: 0.92,
  sources: ['alphavantage', 'sec_edgar', 'company_financials'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockMarketAgentResult = {
  agentId: 'market',
  status: 'completed' as const,
  findings: {
    market_size: {
      tam: 50000000000,
      sam: 10000000000,
      som: 500000000,
      market_share_potential: 0.05
    },
    growth_analysis: {
      historical_cagr: 0.22,
      projected_cagr: 0.25,
      growth_stage: 'expansion',
      maturity: 'mid-stage'
    },
    industry_dynamics: {
      concentration: 'fragmented',
      barriers_to_entry: 'medium',
      buyer_power: 'medium',
      supplier_power: 'low',
      substitution_threat: 'low'
    },
    trends: [
      'Digital transformation acceleration',
      'AI/ML adoption',
      'Remote work enablement'
    ],
    risks: [
      'Economic slowdown',
      'Regulatory changes'
    ]
  },
  confidence: 0.88,
  sources: ['exa', 'perplexity', 'market_research_reports'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockCompetitiveAgentResult = {
  agentId: 'competitive',
  status: 'completed' as const,
  findings: {
    competitive_landscape: {
      direct_competitors: 3,
      indirect_competitors: 7,
      market_leader: 'Competitor A',
      target_ranking: 4
    },
    differentiation: {
      key_strengths: [
        'Superior UX',
        'Faster implementation',
        'Better support'
      ],
      weaknesses: [
        'Smaller brand',
        'Limited geographic reach'
      ],
      unique_value_props: [
        'AI-powered automation',
        'No-code configuration'
      ]
    },
    moat_assessment: {
      network_effects: 6,
      switching_costs: 7,
      brand_strength: 5,
      regulatory_advantages: 3,
      overall_moat_score: 5.25,
      moat_category: 'Narrow moat'
    },
    competitive_threats: [
      'New entrants with lower pricing',
      'Feature parity from larger competitors'
    ]
  },
  confidence: 0.90,
  sources: ['web_scraping', 'review_sites', 'job_postings'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockCustomerAgentResult = {
  agentId: 'customer',
  status: 'completed' as const,
  findings: {
    customer_base: {
      total: 450,
      segments: {
        enterprise: 45,
        mid_market: 180,
        smb: 225
      },
      concentration_risk: 'Low'
    },
    retention_metrics: {
      gross_retention: 0.92,
      net_retention: 1.15,
      churn_rate: 0.08,
      churn_reasons: ['Price', 'Lack of features', 'Poor support']
    },
    acquisition_efficiency: {
      cac: 15000,
      ltv: 125000,
      ltv_cac_ratio: 8.3,
      payback_months: 14,
      efficiency_trend: 'Improving'
    },
    satisfaction: {
      nps: 62,
      csat: 4.3,
      review_sentiment: 'Positive',
      key_praise: ['Easy to use', 'Great support', 'Fast implementation'],
      key_complaints: ['Limited integrations', 'Pricing transparency']
    }
  },
  confidence: 0.87,
  sources: ['review_sites', 'social_media', 'company_data'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockTechnicalAgentResult = {
  agentId: 'technical',
  status: 'completed' as const,
  findings: {
    architecture: {
      quality_score: 7.5,
      scalability: 'Good',
      reliability: 'High',
      tech_stack_modernity: 'Modern',
      key_strengths: ['Cloud-native', 'Microservices', 'Good test coverage'],
      key_concerns: ['Some monolithic components', 'Database bottlenecks']
    },
    development_practices: {
      code_quality: 8.0,
      test_coverage: 0.82,
      ci_cd_maturity: 'Advanced',
      code_review_adoption: 0.95,
      documentation_quality: 'Good'
    },
    security: {
      security_score: 7.8,
      compliance: ['SOC 2', 'GDPR', 'CCPA'],
      vulnerabilities: {
        critical: 0,
        high: 2,
        medium: 8
      },
      last_audit: '2024-09-15'
    },
    technical_debt: {
      debt_score: 6.5,
      estimated_remediation_effort: '3-6 months',
      priority_areas: ['Database optimization', 'Legacy API migration']
    }
  },
  confidence: 0.85,
  sources: ['github', 'security_scan', 'code_analysis'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

export const mockRiskAgentResult = {
  agentId: 'risk',
  status: 'completed' as const,
  findings: {
    overall_risk: {
      score: 4.5,
      category: 'Medium',
      recommendation: 'Proceed with standard due diligence'
    },
    risk_breakdown: {
      execution_risk: { score: 6, impact: 'Medium' },
      market_risk: { score: 5, impact: 'Medium' },
      technology_risk: { score: 4, impact: 'Low' },
      financial_risk: { score: 3, impact: 'Low' },
      regulatory_risk: { score: 4, impact: 'Low' },
      competitive_risk: { score: 6, impact: 'Medium' }
    },
    critical_risks: [],
    high_risks: [
      'Key person dependency on founder',
      'Customer concentration in top 10 accounts'
    ],
    mitigation_strategies: [
      'Implement succession planning',
      'Diversify customer base',
      'Build technical redundancy'
    ]
  },
  confidence: 0.91,
  sources: ['cross_agent_analysis', 'risk_models'],
  timestamp: '2025-01-01T00:00:00.000Z'
};

// Factory function for creating custom agent results
export function createMockAgentResult(
  agentId: string,
  findings: any,
  overrides: Partial<any> = {}
) {
  return {
    agentId,
    status: 'completed' as const,
    findings,
    confidence: 0.90,
    sources: ['mock_source'],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}
