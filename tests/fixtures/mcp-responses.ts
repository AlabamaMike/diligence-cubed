/**
 * Test fixtures for MCP server responses
 */

export const mockAlphaVantageResponse = {
  data: {
    symbol: 'TECH',
    annualReports: [
      {
        fiscalDateEnding: '2024-12-31',
        totalRevenue: '25000000',
        grossProfit: '18750000',
        netIncome: '2000000',
        operatingCashflow: '3500000'
      },
      {
        fiscalDateEnding: '2023-12-31',
        totalRevenue: '18000000',
        grossProfit: '13500000',
        netIncome: '1200000',
        operatingCashflow: '2500000'
      }
    ],
    quarterlyReports: [
      {
        fiscalDateEnding: '2024-12-31',
        totalRevenue: '7000000',
        grossProfit: '5250000',
        netIncome: '600000'
      }
    ]
  },
  status: 'success' as const,
  source: 'alphavantage',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockExaSearchResponse = {
  data: {
    results: [
      {
        title: 'TechCorp Announces Record Growth',
        url: 'https://techcrunch.com/techcorp-growth',
        snippet: 'TechCorp Inc. reported 45% YoY revenue growth...',
        publishedDate: '2024-12-15',
        score: 0.95
      },
      {
        title: 'TechCorp Series B Funding',
        url: 'https://venturebeat.com/techcorp-series-b',
        snippet: 'Leading VCs invest $25M in TechCorp...',
        publishedDate: '2024-11-20',
        score: 0.92
      },
      {
        title: 'TechCorp Customer Success Story',
        url: 'https://techcorp.com/case-study',
        snippet: 'Fortune 500 company achieves 50% cost reduction...',
        publishedDate: '2024-10-05',
        score: 0.88
      }
    ],
    autopromptString: 'TechCorp company analysis due diligence'
  },
  status: 'success' as const,
  source: 'exa',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockPerplexityResponse = {
  data: {
    answer: 'TechCorp Inc. is a rapidly growing B2B SaaS company specializing in workflow automation...',
    citations: [
      'https://techcorp.com/about',
      'https://crunchbase.com/organization/techcorp',
      'https://www.linkedin.com/company/techcorp'
    ],
    confidence: 0.89
  },
  status: 'success' as const,
  source: 'perplexity',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockGitHubResponse = {
  data: {
    organization: 'techcorp',
    repositories: [
      {
        name: 'main-platform',
        stars: 245,
        forks: 42,
        openIssues: 23,
        lastCommit: '2025-01-01',
        languages: {
          TypeScript: 65,
          Python: 25,
          JavaScript: 10
        },
        contributors: 28
      },
      {
        name: 'client-sdk',
        stars: 156,
        forks: 31,
        openIssues: 8,
        lastCommit: '2024-12-28',
        languages: {
          TypeScript: 90,
          JavaScript: 10
        },
        contributors: 12
      }
    ],
    totalContributors: 35,
    commitFrequency: 156,
    averageIssueResolutionDays: 3.5
  },
  status: 'success' as const,
  source: 'github',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockPolygonResponse = {
  data: {
    ticker: 'TECH',
    results: [
      {
        date: '2024-12-31',
        open: 45.50,
        high: 47.80,
        low: 45.10,
        close: 47.25,
        volume: 1250000
      },
      {
        date: '2024-12-30',
        open: 44.20,
        high: 46.00,
        low: 43.90,
        close: 45.50,
        volume: 980000
      }
    ],
    status: 'OK'
  },
  status: 'success' as const,
  source: 'polygon',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockNewsAPIResponse = {
  data: {
    articles: [
      {
        title: 'TechCorp Expands to European Market',
        description: 'Leading SaaS provider announces European expansion...',
        url: 'https://reuters.com/techcorp-europe',
        publishedAt: '2024-12-20T10:00:00Z',
        source: { name: 'Reuters' },
        sentiment: 'positive'
      },
      {
        title: 'Industry Report: TechCorp Among Top Innovators',
        description: 'Gartner recognizes TechCorp as a leader...',
        url: 'https://gartner.com/techcorp-leader',
        publishedAt: '2024-12-15T14:30:00Z',
        source: { name: 'Gartner' },
        sentiment: 'positive'
      },
      {
        title: 'TechCorp Faces Competition from New Entrant',
        description: 'Startup challenges TechCorp with lower pricing...',
        url: 'https://techcrunch.com/new-competitor',
        publishedAt: '2024-12-10T09:15:00Z',
        source: { name: 'TechCrunch' },
        sentiment: 'neutral'
      }
    ],
    totalResults: 156
  },
  status: 'success' as const,
  source: 'newsapi',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false
};

export const mockMCPErrorResponse = {
  data: null,
  status: 'error' as const,
  source: 'alphavantage',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'API rate limit exceeded',
    retryAfter: 60
  }
};

export const mockMCPTimeoutResponse = {
  data: null,
  status: 'error' as const,
  source: 'exa',
  timestamp: '2025-01-01T00:00:00.000Z',
  cached: false,
  error: {
    code: 'TIMEOUT',
    message: 'Request timeout after 30s'
  }
};

// Factory functions for creating custom responses
export function createMockMCPResponse(
  source: string,
  data: any,
  overrides: Partial<any> = {}
) {
  return {
    data,
    status: 'success' as const,
    source,
    timestamp: new Date().toISOString(),
    cached: false,
    ...overrides
  };
}

export function createMockMCPError(
  source: string,
  errorCode: string,
  errorMessage: string
) {
  return {
    data: null,
    status: 'error' as const,
    source,
    timestamp: new Date().toISOString(),
    cached: false,
    error: {
      code: errorCode,
      message: errorMessage
    }
  };
}
