/**
 * MCP Integration Layer - Example Usage
 *
 * This file demonstrates how to use the MCP integration layer
 * for due diligence research
 */

import { MCPServerManager } from './manager';
import { MCPManagerConfig, MCPRequest } from '../types/mcp';

/**
 * Example: Initialize MCP Manager
 */
async function initializeManager(): Promise<MCPServerManager> {
  const config: MCPManagerConfig = {
    servers: {
      alphavantage: {
        name: 'alphavantage',
        apiKey: process.env.ALPHAVANTAGE_API_KEY || '',
        rateLimit: {
          requestsPerInterval: 500,
          interval: 'day',
          concurrentRequests: 5,
        },
        timeout: 30000,
        retryAttempts: 3,
        fallbackServers: ['polygon'],
      },
      polygon: {
        name: 'polygon',
        apiKey: process.env.POLYGON_API_KEY || '',
        rateLimit: {
          requestsPerInterval: 5,
          interval: 'minute',
          concurrentRequests: 3,
        },
        timeout: 30000,
        retryAttempts: 3,
        fallbackServers: ['alphavantage'],
      },
      exa: {
        name: 'exa',
        apiKey: process.env.EXA_API_KEY || '',
        rateLimit: {
          requestsPerInterval: 1000,
          interval: 'month',
          concurrentRequests: 5,
        },
        timeout: 30000,
        retryAttempts: 3,
        fallbackServers: ['perplexity'],
      },
      perplexity: {
        name: 'perplexity',
        apiKey: process.env.PERPLEXITY_API_KEY || '',
        rateLimit: {
          requestsPerInterval: 100,
          interval: 'minute',
          concurrentRequests: 3,
        },
        timeout: 60000,
        retryAttempts: 2,
        fallbackServers: ['exa'],
      },
      github: {
        name: 'github',
        apiKey: process.env.GITHUB_TOKEN || '',
        rateLimit: {
          requestsPerInterval: 5000,
          interval: 'hour',
          concurrentRequests: 10,
        },
        timeout: 30000,
        retryAttempts: 3,
      },
      newsapi: {
        name: 'newsapi',
        apiKey: process.env.NEWSAPI_KEY || '',
        rateLimit: {
          requestsPerInterval: 500,
          interval: 'day',
          concurrentRequests: 5,
        },
        timeout: 30000,
        retryAttempts: 3,
      },
    },
    defaultCacheTTL: 3600, // 1 hour
    enableCache: true,
    maxQueueSize: 1000,
    globalTimeout: 30000,
    redisUrl: process.env.REDIS_URL,
  };

  const manager = new MCPServerManager(config);
  await manager.initialize();

  return manager;
}

/**
 * Example: Basic financial data retrieval
 */
async function getFinancialData(
  manager: MCPServerManager,
  symbol: string
): Promise<void> {
  console.log(`\n=== Fetching Financial Data for ${symbol} ===`);

  // Get company overview from AlphaVantage
  const overviewRequest: MCPRequest = {
    id: `av_overview_${symbol}_${Date.now()}`,
    server: 'alphavantage',
    endpoint: 'getCompanyOverview',
    params: { symbol },
    priority: 1,
    cacheConfig: {
      ttl: 86400, // Cache for 24 hours
      enabled: true,
    },
  };

  const overview = await manager.executeWithFallback(overviewRequest);

  if (overview.success) {
    console.log('Company Overview:', overview.data);
    console.log('Source:', overview.source);
    console.log('Cached:', overview.cached);
  } else {
    console.error('Failed to fetch company overview:', overview.error);
  }

  // Get market data from Polygon
  const marketDataRequest: MCPRequest = {
    id: `polygon_market_${symbol}_${Date.now()}`,
    server: 'polygon',
    endpoint: 'getMarketDataPackage',
    params: { ticker: symbol },
    priority: 1,
    cacheConfig: {
      ttl: 300, // Cache for 5 minutes
      enabled: true,
    },
  };

  const marketData = await manager.executeWithFallback(marketDataRequest);

  if (marketData.success) {
    console.log('Market Data:', marketData.data);
  } else {
    console.error('Failed to fetch market data:', marketData.error);
  }
}

/**
 * Example: Company research using multiple sources
 */
async function performCompanyResearch(
  manager: MCPServerManager,
  companyName: string,
  industry: string
): Promise<void> {
  console.log(`\n=== Performing Research on ${companyName} ===`);

  const requests: MCPRequest[] = [
    // Search company information with Exa
    {
      id: `exa_company_${Date.now()}`,
      server: 'exa',
      endpoint: 'searchCompany',
      params: {
        companyName,
        options: {
          includeFinancials: true,
          includeNews: true,
          numResults: 10,
        },
      },
      priority: 2,
    },
    // Search for latest news
    {
      id: `news_company_${Date.now()}`,
      server: 'newsapi',
      endpoint: 'searchCompanyNews',
      params: {
        companyName,
        options: {
          daysBack: 30,
          pageSize: 20,
        },
      },
      priority: 1,
    },
    // Search with Perplexity for comprehensive analysis
    {
      id: `perplexity_research_${Date.now()}`,
      server: 'perplexity',
      endpoint: 'comprehensiveResearch',
      params: { companyName, industry },
      priority: 2,
    },
  ];

  // Execute all requests in parallel
  const results = await manager.executeBatch(requests);

  results.forEach((result, index) => {
    console.log(`\nResult ${index + 1}:`);
    console.log('Success:', result.success);
    console.log('Source:', result.source);
    console.log('Cached:', result.cached);
    if (result.success) {
      console.log('Data:', JSON.stringify(result.data, null, 2).substring(0, 500));
    } else {
      console.log('Error:', result.error);
    }
  });
}

/**
 * Example: GitHub analysis for tech companies
 */
async function analyzeGitHubPresence(
  manager: MCPServerManager,
  orgName: string
): Promise<void> {
  console.log(`\n=== Analyzing GitHub Presence for ${orgName} ===`);

  const request: MCPRequest = {
    id: `github_org_${orgName}_${Date.now()}`,
    server: 'github',
    endpoint: 'analyzeOrganization',
    params: { org: orgName },
    priority: 2,
    cacheConfig: {
      ttl: 3600, // Cache for 1 hour
      enabled: true,
    },
  };

  const result = await manager.executeRequest(request);

  if (result.success) {
    console.log('Organization Data:', result.data);
  } else {
    console.error('Failed to analyze GitHub:', result.error);
  }
}

/**
 * Example: Monitor system health
 */
async function monitorHealth(manager: MCPServerManager): Promise<void> {
  console.log('\n=== System Health Check ===');

  // Check all servers
  const health = await manager.healthCheck();
  console.log('Health Status:', health);

  // Get statistics
  const stats = manager.getStats();
  console.log('\nStatistics:', {
    totalRequests: stats.totalRequests,
    successRate: (stats.successfulRequests / stats.totalRequests * 100).toFixed(2) + '%',
    cacheHitRate: (stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100).toFixed(2) + '%',
    avgResponseTime: stats.avgResponseTime.toFixed(2) + 'ms',
  });

  // Get cache stats
  const cacheStats = await manager.getCacheStats();
  console.log('\nCache Stats:', cacheStats);

  // Get rate limiter stats
  const rateLimiterStats = manager.getRateLimiterStats();
  console.log('\nRate Limiter Stats:', rateLimiterStats);

  // Get error stats
  const errorStats = manager.getErrorStats();
  console.log('\nError Stats:', errorStats);
}

/**
 * Example: Complete due diligence workflow
 */
async function performDueDiligence(
  companyName: string,
  ticker: string,
  industry: string,
  githubOrg?: string
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting Due Diligence for ${companyName}`);
  console.log('='.repeat(60));

  const manager = await initializeManager();

  try {
    // 1. Financial Analysis
    await getFinancialData(manager, ticker);

    // 2. Company Research
    await performCompanyResearch(manager, companyName, industry);

    // 3. GitHub Analysis (if applicable)
    if (githubOrg) {
      await analyzeGitHubPresence(manager, githubOrg);
    }

    // 4. Monitor Health
    await monitorHealth(manager);

    console.log('\n=== Due Diligence Complete ===');
  } catch (error) {
    console.error('Error during due diligence:', error);
  } finally {
    // Cleanup
    await manager.shutdown();
  }
}

/**
 * Example: Direct client access
 */
async function useDirectClient(manager: MCPServerManager): Promise<void> {
  console.log('\n=== Using Direct Client Access ===');

  // Get AlphaVantage client directly
  const avClient = manager.getClient<any>('alphavantage');

  if (avClient) {
    const result = await avClient.getCompanyOverview('MSFT');
    console.log('Direct client result:', result);
  }
}

// Main execution example
if (require.main === module) {
  performDueDiligence(
    'Microsoft Corporation',
    'MSFT',
    'Technology',
    'microsoft'
  ).catch(console.error);
}

export {
  initializeManager,
  getFinancialData,
  performCompanyResearch,
  analyzeGitHubPresence,
  monitorHealth,
  performDueDiligence,
  useDirectClient,
};
