# MCP Integration Layer

The MCP (Model Context Protocol) Integration Layer provides a unified interface for accessing multiple external data sources required for due diligence research.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCPServerManager                          │
│  - Request orchestration                                     │
│  - Server health monitoring                                  │
│  - Statistics and metrics                                    │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┼────────┬────────────┬───────────┐
    │        │        │            │           │
    ▼        ▼        ▼            ▼           ▼
┌────────┐ ┌────┐ ┌──────────┐ ┌────────┐ ┌────────┐
│ Cache  │ │Rate│ │  Error   │ │ Server │ │ Server │
│ Layer  │ │Lim │ │ Handler  │ │Client 1│ │Client N│
└────────┘ └────┘ └──────────┘ └────────┘ └────────┘
```

## Components

### 1. MCPServerManager (`manager.ts`)

Central orchestrator for all MCP server interactions.

**Features:**
- Request routing to appropriate server clients
- Automatic fallback to alternative data sources
- Request batching and parallel execution
- Server health monitoring and auto-recovery
- Comprehensive statistics and metrics

**Example Usage:**

```typescript
import { MCPServerManager } from './mcp';

const manager = new MCPServerManager({
  servers: {
    alphavantage: {
      name: 'alphavantage',
      apiKey: process.env.ALPHAVANTAGE_API_KEY,
      rateLimit: {
        requestsPerInterval: 500,
        interval: 'day',
      },
      fallbackServers: ['polygon'],
    },
    // ... other servers
  },
  defaultCacheTTL: 3600,
  enableCache: true,
  maxQueueSize: 1000,
  globalTimeout: 30000,
  redisUrl: process.env.REDIS_URL,
});

await manager.initialize();

// Execute a request
const response = await manager.executeRequest({
  id: 'req_123',
  server: 'alphavantage',
  endpoint: 'getCompanyOverview',
  params: { symbol: 'AAPL' },
  priority: 1,
});
```

### 2. MCPCache (`cache.ts`)

Redis-backed caching system with memory fallback.

**Features:**
- Automatic cache key generation
- TTL (Time To Live) management
- Memory fallback when Redis is unavailable
- Pattern-based cache invalidation
- Health monitoring

**Example Usage:**

```typescript
const cache = new MCPCache(redisUrl, defaultTTL);
await cache.connect();

// Generate cache key
const key = cache.generateCacheKey('alphavantage', 'overview', { symbol: 'AAPL' });

// Get from cache
const cached = await cache.get(key);

// Set in cache
await cache.set(key, data, 3600);

// Clear by pattern
await cache.clearByPattern('alphavantage:*');
```

### 3. RateLimiter (`rate-limiter.ts`)

Per-server rate limiting with intelligent queueing.

**Features:**
- Configurable rate limits per server
- Request priority queuing
- Concurrent request limiting
- Automatic request spacing
- Queue statistics and monitoring

**Example Usage:**

```typescript
const rateLimiter = new RateLimiter();

rateLimiter.register('alphavantage', {
  requestsPerInterval: 500,
  interval: 'day',
  concurrentRequests: 5,
});

// Execute with rate limiting
const result = await rateLimiter.execute(
  'alphavantage',
  () => fetchData(),
  priority
);

// Check queue status
const status = rateLimiter.getQueueStatus('alphavantage');
```

### 4. MCPErrorHandler (`error-handler.ts`)

Intelligent error handling with retry logic and fallbacks.

**Features:**
- Exponential backoff with jitter
- Error classification and handling
- Automatic fallback source selection
- Error statistics and monitoring
- Retry wrapper for any async function

**Example Usage:**

```typescript
const errorHandler = new MCPErrorHandler({
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
});

// Register fallback sources
errorHandler.registerFallback('alphavantage', ['polygon']);

// Execute with retry
const result = await errorHandler.withRetry(
  () => apiCall(),
  'alphavantage',
  request
);

// Get error statistics
const stats = errorHandler.getErrorStats('alphavantage');
```

## Server Clients

### AlphaVantage (`servers/alphavantage.ts`)

Financial data and company fundamentals.

**Methods:**
- `getCompanyOverview(symbol)` - Company overview and fundamentals
- `getIncomeStatement(symbol)` - Income statement data
- `getBalanceSheet(symbol)` - Balance sheet data
- `getCashFlow(symbol)` - Cash flow statement
- `getEarnings(symbol)` - Earnings data
- `getTimeSeries(params)` - Historical price data
- `getFinancialPackage(symbol)` - Complete financial package

### Exa.ai (`servers/exa.ts`)

Deep web search and research.

**Methods:**
- `search(params)` - Neural search
- `findSimilar(url)` - Find similar content
- `getContents(ids)` - Get full content for URLs
- `searchCompany(name)` - Company-specific search
- `searchCompetitors(name, industry)` - Competitive intelligence
- `searchMarketResearch(industry, topics)` - Market research

### Perplexity (`servers/perplexity.ts`)

Real-time search with citations.

**Methods:**
- `search(params)` - General search
- `searchCompany(name)` - Company information
- `searchMarketTrends(industry)` - Market trends
- `searchCompetitors(name, industry)` - Competitive analysis
- `searchFinancials(name)` - Financial information
- `searchNews(name)` - Latest news
- `searchRisks(name, industry)` - Risk analysis
- `comprehensiveResearch(name, industry)` - Full research package

### GitHub (`servers/github.ts`)

Code analysis and repository metrics.

**Methods:**
- `getRepository(owner, repo)` - Repository information
- `getCodeQualityMetrics(owner, repo)` - Code quality metrics
- `getOrganizationRepos(org)` - All organization repositories
- `getOrganization(org)` - Organization information
- `analyzeRepository(owner, repo)` - Complete repository analysis
- `analyzeOrganization(org)` - Organization analysis

### NewsAPI (`servers/newsapi.ts`)

News monitoring and sentiment analysis.

**Methods:**
- `searchEverything(params)` - Search all news
- `getTopHeadlines(params)` - Top headlines
- `searchCompanyNews(name)` - Company-specific news
- `searchIndustryNews(industry)` - Industry news
- `searchNegativeNews(name)` - Negative sentiment news
- `searchPositiveNews(name)` - Positive sentiment news
- `getComprehensiveNews(name)` - Full news analysis
- `searchMAndANews(name)` - M&A related news
- `searchLeadershipNews(name)` - Leadership changes

### Polygon.io (`servers/polygon.ts`)

Real-time market data and financial information.

**Methods:**
- `getTickerDetails(ticker)` - Ticker information
- `getAggregates(params)` - Historical aggregates (bars)
- `getPreviousClose(ticker)` - Previous day's data
- `getSnapshot(ticker)` - Real-time snapshot
- `getDailyPrices(ticker, days)` - Daily price history
- `getFinancials(ticker)` - Financial statements
- `getMarketDataPackage(ticker)` - Complete market data
- `getPriceMetrics(ticker, days)` - Calculated price metrics

## Configuration

### Server Configuration

Each server requires specific configuration:

```typescript
interface MCPServerConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  rateLimit: {
    requestsPerInterval: number;
    interval: 'second' | 'minute' | 'hour' | 'day' | 'month';
    concurrentRequests?: number;
  };
  timeout?: number;
  retryAttempts?: number;
  fallbackServers?: string[];
}
```

### Environment Variables

Required environment variables:

```bash
# AlphaVantage
ALPHAVANTAGE_API_KEY=your_key

# Exa.ai
EXA_API_KEY=your_key

# Perplexity
PERPLEXITY_API_KEY=your_key

# GitHub
GITHUB_TOKEN=your_token

# NewsAPI
NEWSAPI_KEY=your_key

# Polygon.io
POLYGON_API_KEY=your_key

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

## Error Handling

The system provides comprehensive error handling:

1. **Automatic Retries**: Failed requests are automatically retried with exponential backoff
2. **Fallback Sources**: If a primary source fails, the system tries configured fallback sources
3. **Circuit Breakers**: Servers with high error rates are temporarily disabled
4. **Error Classification**: Errors are classified (rate limit, auth, timeout, etc.) for appropriate handling

## Caching Strategy

Intelligent caching improves performance and reduces API costs:

- **Financial Data**: 1 hour TTL (less volatile)
- **News Data**: 15 minutes TTL (more volatile)
- **Company Information**: 24 hours TTL (rarely changes)
- **Market Data**: 5 minutes TTL (real-time)

## Rate Limiting

Each server has specific rate limits:

| Server | Free Tier | Paid Tier |
|--------|-----------|-----------|
| AlphaVantage | 500/day | Unlimited |
| Exa.ai | 1000/month | Custom |
| Perplexity | API-based | API-based |
| GitHub | 5000/hour | 5000/hour |
| NewsAPI | 500/day | Custom |
| Polygon.io | 5/minute | Custom |

## Monitoring and Metrics

The system provides comprehensive metrics:

```typescript
const stats = manager.getStats();
// {
//   totalRequests: 1000,
//   successfulRequests: 950,
//   failedRequests: 50,
//   cacheHits: 600,
//   cacheMisses: 400,
//   avgResponseTime: 250,
//   serverStates: {...}
// }

const health = await manager.healthCheck();
// {
//   alphavantage: { healthy: true, responseTime: 200 },
//   exa: { healthy: true, responseTime: 150 },
//   ...
// }
```

## Best Practices

1. **Always use the manager** - Don't instantiate server clients directly
2. **Set appropriate priorities** - Critical requests should have higher priority
3. **Configure fallbacks** - Always have backup data sources
4. **Monitor health** - Regularly check server health status
5. **Clear cache strategically** - Clear cache when data freshness is critical
6. **Handle errors gracefully** - Always check response.success before using data

## Testing

```typescript
// Health check all servers
const health = await manager.healthCheck();

// Test specific server
const client = manager.getClient<AlphaVantageClient>('alphavantage');
const isHealthy = await client.healthCheck();

// Test with fallback
const response = await manager.executeWithFallback({
  id: 'test_1',
  server: 'alphavantage',
  endpoint: 'getCompanyOverview',
  params: { symbol: 'AAPL' },
});
```

## Performance Optimization

1. **Use batching** - Group related requests
2. **Enable caching** - Reduce redundant API calls
3. **Set appropriate TTLs** - Balance freshness vs performance
4. **Use fallbacks** - Ensure high availability
5. **Monitor queue depths** - Adjust rate limits if needed

## Troubleshooting

### High Error Rates
- Check API key validity
- Verify rate limits aren't exceeded
- Check network connectivity
- Review error logs for patterns

### Slow Response Times
- Check Redis connectivity
- Review rate limiter queue depths
- Monitor server health
- Consider increasing concurrent requests

### Cache Issues
- Verify Redis is running
- Check memory fallback is working
- Review TTL settings
- Monitor cache hit rates

## Future Enhancements

- [ ] Add more MCP servers (Brave Search, etc.)
- [ ] Implement request deduplication
- [ ] Add request/response transformation hooks
- [ ] Implement advanced circuit breaker patterns
- [ ] Add distributed rate limiting across instances
- [ ] Implement request prioritization based on business rules
- [ ] Add comprehensive audit logging
