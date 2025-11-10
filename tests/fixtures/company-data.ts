/**
 * Test fixtures for company data
 */

export const mockCompanyBasicInfo = {
  name: 'TechCorp Inc.',
  domain: 'techcorp.com',
  industry: 'Software',
  founded: '2015',
  headquarters: 'San Francisco, CA',
  employees: 250,
  funding: {
    total: 50000000,
    last_round: 'Series B',
    investors: ['Sequoia Capital', 'Andreessen Horowitz']
  }
};

export const mockCompanyFinancials = {
  revenue: {
    current_arr: 25000000,
    previous_year: 18000000,
    growth_rate: 0.389,
    revenue_quality_score: 0.85
  },
  profitability: {
    gross_margin: 0.75,
    ebitda_margin: 0.15,
    net_margin: 0.08,
    fcf_conversion: 0.72
  },
  cash_flow: {
    operating_cash_flow: 3500000,
    capex: -500000,
    free_cash_flow: 3000000
  },
  balance_sheet: {
    cash: 15000000,
    total_assets: 35000000,
    total_liabilities: 12000000,
    equity: 23000000
  },
  metrics: {
    burn_rate: -500000,
    runway_months: 30,
    rule_of_40: 54,
    magic_number: 0.85
  }
};

export const mockMarketAnalysis = {
  market_size: {
    tam: 50000000000,
    sam: 10000000000,
    som: 500000000
  },
  growth_rate: 0.25,
  trends: [
    'Cloud migration acceleration',
    'AI/ML adoption',
    'Remote work enablement'
  ],
  drivers: [
    'Digital transformation initiatives',
    'Regulatory compliance requirements',
    'Cost optimization pressure'
  ],
  headwinds: [
    'Economic uncertainty',
    'Increased competition'
  ]
};

export const mockCompetitiveAnalysis = {
  direct_competitors: [
    {
      name: 'Competitor A',
      market_share: 0.25,
      revenue: 100000000,
      strengths: ['Brand recognition', 'Large customer base']
    },
    {
      name: 'Competitor B',
      market_share: 0.18,
      revenue: 75000000,
      strengths: ['Technology innovation', 'Lower pricing']
    }
  ],
  indirect_competitors: [
    'Alternative Solution Provider',
    'DIY Tools'
  ],
  target_market_share: 0.05,
  competitive_advantages: [
    'Superior user experience',
    'Faster implementation',
    'Better customer support'
  ],
  weaknesses: [
    'Smaller sales team',
    'Limited geographic presence'
  ],
  moat_assessment: {
    network_effects: 6,
    switching_costs: 7,
    brand: 5,
    regulatory: 3,
    overall_score: 5.25
  }
};

export const mockCustomerData = {
  total_customers: 450,
  customer_concentration: {
    top_10_revenue_percent: 0.35,
    largest_customer_percent: 0.08
  },
  retention: {
    gross_retention: 0.92,
    net_retention: 0.115,
    churn_rate: 0.08,
    cohort_analysis: {
      'Year 1': 0.85,
      'Year 2': 0.90,
      'Year 3': 0.95
    }
  },
  acquisition: {
    cac: 15000,
    ltv: 125000,
    ltv_cac_ratio: 8.3,
    payback_period_months: 14
  },
  satisfaction: {
    nps: 62,
    csat: 4.3,
    review_scores: {
      g2: 4.6,
      capterra: 4.5
    }
  }
};

export const mockTechnicalAnalysis = {
  tech_stack: {
    frontend: ['React', 'TypeScript', 'Next.js'],
    backend: ['Node.js', 'Python', 'PostgreSQL'],
    infrastructure: ['AWS', 'Docker', 'Kubernetes'],
    ai_ml: ['TensorFlow', 'PyTorch']
  },
  code_quality: {
    test_coverage: 0.82,
    code_review_adoption: 0.95,
    ci_cd_maturity: 'high',
    technical_debt_score: 6.5
  },
  security: {
    last_audit: '2024-09-15',
    vulnerabilities: {
      critical: 0,
      high: 2,
      medium: 8,
      low: 15
    },
    compliance: ['SOC 2 Type II', 'GDPR', 'CCPA']
  },
  scalability: {
    current_capacity: '10K requests/second',
    bottlenecks: ['Database queries', 'Third-party API calls'],
    planned_improvements: ['Caching layer', 'Database sharding']
  }
};

export const mockRiskAssessment = {
  execution_risk: {
    score: 6,
    factors: [
      'Experienced management team',
      'Proven product-market fit',
      'Some key person dependencies'
    ]
  },
  market_risk: {
    score: 5,
    factors: [
      'Growing market',
      'Increasing competition',
      'Economic sensitivity'
    ]
  },
  technology_risk: {
    score: 4,
    factors: [
      'Modern tech stack',
      'Some technical debt',
      'Dependent on AWS'
    ]
  },
  financial_risk: {
    score: 3,
    factors: [
      'Strong cash position',
      'Path to profitability clear',
      'Minor customer concentration'
    ]
  },
  overall_risk_score: 4.5,
  risk_category: 'Medium',
  mitigation_strategies: [
    'Diversify customer base',
    'Reduce technical debt',
    'Build multi-cloud capability'
  ]
};
