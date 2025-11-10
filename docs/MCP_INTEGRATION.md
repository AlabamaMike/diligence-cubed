# MCP Integration Guide

This document provides comprehensive setup and configuration instructions for integrating MCP (Model Context Protocol) servers with Diligence Cubed.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [MCP Server Setup](#mcp-server-setup)
  - [AlphaVantage](#alphavantage)
  - [Exa.ai](#exaai)
  - [Perplexity](#perplexity)
  - [GitHub](#github)
  - [NewsAPI](#newsapi)
  - [Polygon.io](#polygonio)
- [Configuration](#configuration)
- [Rate Limits and Costs](#rate-limits-and-costs)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

Diligence Cubed integrates with multiple MCP servers to gather comprehensive data for due diligence analysis. Each MCP server provides specialized data:

| MCP Server | Data Type | Required | Use Case |
|------------|-----------|----------|----------|
| AlphaVantage | Financial fundamentals | Yes | Financial analysis, valuations |
| Exa.ai | Deep web search | Yes | Market research, competitor analysis |
| Perplexity | Real-time search | Recommended | News, recent developments |
| GitHub | Code repositories | For tech companies | Technical due diligence |
| NewsAPI | News articles | Recommended | Sentiment analysis, news monitoring |
| Polygon.io | Market data | Optional | Real-time pricing, options data |

## Quick Start

### 1. Get API Keys

Sign up for each MCP server and obtain API keys:

- AlphaVantage: https://www.alphavantage.co/support/#api-key
- Exa.ai: https://exa.ai/api
- Perplexity: https://www.perplexity.ai/api
- GitHub: https://github.com/settings/tokens
- NewsAPI: https://newsapi.org/account
- Polygon.io: https://polygon.io/dashboard/api-keys

### 2. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Required MCP Servers
ALPHAVANTAGE_API_KEY=your_alphavantage_key
EXA_API_KEY=your_exa_key

# Recommended MCP Servers
PERPLEXITY_API_KEY=your_perplexity_key
NEWS_API_KEY=your_newsapi_key

# Optional MCP Servers
GITHUB_TOKEN=your_github_token
POLYGON_API_KEY=your_polygon_key

# Cache Configuration (Optional)
MCP_CACHE_ENABLED=true
MCP_CACHE_TTL=3600
```

### 3. Test Configuration

```typescript
import { DiligenceClient } from 'diligence-cubed';

const client = new DiligenceClient({
  apiKey: 'your-api-key',
  mcpServers: {
    alphavantage: process.env.ALPHAVANTAGE_API_KEY,
    exa: process.env.EXA_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    github: process.env.GITHUB_TOKEN,
    newsapi: process.env.NEWS_API_KEY,
    polygon: process.env.POLYGON_API_KEY
  }
});

// Test connection
const status = await client.testMCPConnections();
console.log(status);
```

## MCP Server Setup

### AlphaVantage

Financial fundamentals, earnings data, and cash flow analysis.

#### Setup

1. **Create Account**: Visit https://www.alphavantage.co/support/#api-key
2. **Get API Key**: Free tier includes 500 requests/day
3. **Upgrade Options**: Premium plans available for higher limits

#### Configuration

```typescript
{
  mcpServers: {
    alphavantage: {
      apiKey: process.env.ALPHAVANTAGE_API_KEY,
      rateLimit: {
        requests: 500,
        period: 'day'
      },
      timeout: 30000
    }
  }
}
```

#### Available Data

- **Company Overview**: Basic company information
- **Income Statement**: Revenue, expenses, net income
- **Balance Sheet**: Assets, liabilities, equity
- **Cash Flow**: Operating, investing, financing cash flow
- **Earnings**: EPS, earnings surprises
- **Key Ratios**: P/E, P/B, ROE, etc.

#### Example Usage

```typescript
// Query company overview
const overview = await mcpManager.query('alphavantage', {
  method: 'OVERVIEW',
  params: { symbol: 'AAPL' }
});

// Get income statement
const income = await mcpManager.query('alphavantage', {
  method: 'INCOME_STATEMENT',
  params: { symbol: 'AAPL' }
});
```

#### Rate Limits

- **Free Tier**: 500 requests/day, 5 requests/minute
- **Premium Tier**: Unlimited requests (from $50/month)

#### Cost

- **Free**: 500 requests/day
- **Basic**: $50/month (1,200 requests/minute)
- **Professional**: $250/month (unlimited)

#### Troubleshooting

- **Error: API rate limit reached**: Wait for rate limit window to reset or upgrade plan
- **Error: Invalid API key**: Check that API key is correctly configured
- **Empty response**: Verify ticker symbol is valid and traded on US markets

### Exa.ai

Deep web search and content extraction.

#### Setup

1. **Create Account**: Visit https://exa.ai
2. **Get API Key**: From your dashboard
3. **Choose Plan**: Free tier includes 1,000 searches/month

#### Configuration

```typescript
{
  mcpServers: {
    exa: {
      apiKey: process.env.EXA_API_KEY,
      rateLimit: {
        requests: 1000,
        period: 'month'
      },
      timeout: 60000  // Longer timeout for deep searches
    }
  }
}
```

#### Available Features

- **Neural Search**: AI-powered semantic search
- **Content Extraction**: Full-text extraction from web pages
- **Similar Content**: Find similar articles/pages
- **Domain Filtering**: Restrict searches to specific domains
- **Date Filtering**: Search within specific time ranges

#### Example Usage

```typescript
// Deep search for company information
const search = await mcpManager.query('exa', {
  method: 'search',
  params: {
    query: 'Acme Corp market analysis revenue growth',
    numResults: 10,
    useAutoprompt: true,
    category: 'company'
  }
});

// Get full content from URLs
const content = await mcpManager.query('exa', {
  method: 'getContents',
  params: {
    ids: search.results.map(r => r.id),
    text: true
  }
});
```

#### Rate Limits

- **Free Tier**: 1,000 searches/month
- **Basic Tier**: 10,000 searches/month
- **Pro Tier**: 100,000 searches/month

#### Cost

- **Free**: 1,000 searches/month
- **Basic**: $100/month (10,000 searches)
- **Professional**: $500/month (100,000 searches)
- **Enterprise**: Custom pricing

#### Troubleshooting

- **Error: Monthly quota exceeded**: Wait for next billing cycle or upgrade plan
- **Slow responses**: Deep searches can take 10-30 seconds, increase timeout
- **No results found**: Try broader search terms or disable domain filters

### Perplexity

Real-time search and AI-powered answers.

#### Setup

1. **Create Account**: Visit https://www.perplexity.ai
2. **Get API Key**: Access API through dashboard
3. **Choose Plan**: Usage-based pricing

#### Configuration

```typescript
{
  mcpServers: {
    perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: 'pplx-70b-online',  // Real-time search model
      timeout: 45000
    }
  }
}
```

#### Available Models

- **pplx-7b-online**: Fast, real-time search
- **pplx-70b-online**: High-quality, real-time search (recommended)
- **pplx-7b-chat**: Conversational without search
- **pplx-70b-chat**: High-quality conversational

#### Example Usage

```typescript
// Real-time search query
const answer = await mcpManager.query('perplexity', {
  method: 'chat',
  params: {
    model: 'pplx-70b-online',
    messages: [{
      role: 'user',
      content: 'What are the latest news and developments about Acme Corp?'
    }]
  }
});
```

#### Rate Limits

- **Rate Limit**: Based on tokens per minute
- **Default**: 10 requests/second

#### Cost

- **Usage-based pricing**: ~$1 per 1M tokens
- **Request cost**: ~$0.01-0.05 per search query

#### Troubleshooting

- **Error: Rate limit exceeded**: Implement request queuing
- **Outdated information**: Specify date range in query
- **Too general response**: Make queries more specific

### GitHub

Code repository analysis and metrics.

#### Setup

1. **Create Token**: Go to https://github.com/settings/tokens
2. **Select Scopes**:
   - `repo` (for private repos)
   - `read:org` (for organization data)
   - `read:user` (for user data)
3. **Generate Token**: Save securely

#### Configuration

```typescript
{
  mcpServers: {
    github: {
      apiKey: process.env.GITHUB_TOKEN,
      rateLimit: {
        requests: 5000,
        period: 'hour'
      }
    }
  }
}
```

#### Available Data

- **Repository Information**: Stars, forks, issues, PRs
- **Commit History**: Commit frequency, contributors
- **Code Quality**: Languages, file structure
- **Issue Analysis**: Open/closed issues, response time
- **Release History**: Version history, changelog

#### Example Usage

```typescript
// Get repository information
const repo = await mcpManager.query('github', {
  method: 'getRepository',
  params: {
    owner: 'acme-corp',
    repo: 'main-product'
  }
});

// Get commit activity
const commits = await mcpManager.query('github', {
  method: 'getCommits',
  params: {
    owner: 'acme-corp',
    repo: 'main-product',
    since: '2024-01-01'
  }
});
```

#### Rate Limits

- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour

#### Cost

- **Free**: 5,000 requests/hour with authentication

#### Troubleshooting

- **Error 404**: Repository may be private or doesn't exist
- **Error 403**: Token lacks required permissions
- **Rate limit exceeded**: Wait for hourly reset or use multiple tokens

### NewsAPI

News articles and media monitoring.

#### Setup

1. **Create Account**: Visit https://newsapi.org/register
2. **Get API Key**: Available in dashboard
3. **Choose Plan**: Free tier includes 100 requests/day

#### Configuration

```typescript
{
  mcpServers: {
    newsapi: {
      apiKey: process.env.NEWS_API_KEY,
      rateLimit: {
        requests: 100,
        period: 'day'
      },
      country: 'us',
      language: 'en'
    }
  }
}
```

#### Available Endpoints

- **/everything**: Search all articles
- **/top-headlines**: Breaking news headlines
- **/sources**: Available news sources

#### Example Usage

```typescript
// Search for company news
const news = await mcpManager.query('newsapi', {
  method: 'everything',
  params: {
    q: 'Acme Corp',
    sortBy: 'publishedAt',
    language: 'en',
    from: '2024-01-01'
  }
});

// Get top headlines
const headlines = await mcpManager.query('newsapi', {
  method: 'top-headlines',
  params: {
    q: 'technology',
    category: 'business',
    country: 'us'
  }
});
```

#### Rate Limits

- **Free**: 100 requests/day
- **Developer**: 500 requests/day
- **Business**: Unlimited

#### Cost

- **Free**: 100 requests/day (development only)
- **Developer**: $449/month (500 requests/day, production use)
- **Business**: $999/month (unlimited)

#### Troubleshooting

- **Limited results**: Free tier has 1-month lookback limit
- **Error 426**: Upgrade required for production use
- **Missing articles**: Some sources require premium plan

### Polygon.io

Real-time market data and options.

#### Setup

1. **Create Account**: Visit https://polygon.io/dashboard/signup
2. **Get API Key**: Available in dashboard
3. **Choose Plan**: Free tier includes 5 requests/minute

#### Configuration

```typescript
{
  mcpServers: {
    polygon: {
      apiKey: process.env.POLYGON_API_KEY,
      rateLimit: {
        requests: 5,
        period: 'minute'
      }
    }
  }
}
```

#### Available Data

- **Stock Quotes**: Real-time and historical quotes
- **Aggregates**: OHLC data (bars)
- **Trades**: Individual trade data
- **Options**: Options chains and pricing
- **Forex**: Currency exchange rates
- **Crypto**: Cryptocurrency data

#### Example Usage

```typescript
// Get stock quote
const quote = await mcpManager.query('polygon', {
  method: 'quote',
  params: {
    symbol: 'AAPL'
  }
});

// Get historical aggregates
const bars = await mcpManager.query('polygon', {
  method: 'aggregates',
  params: {
    symbol: 'AAPL',
    multiplier: 1,
    timespan: 'day',
    from: '2024-01-01',
    to: '2024-12-31'
  }
});
```

#### Rate Limits

- **Free**: 5 requests/minute
- **Starter**: 100 requests/minute
- **Developer**: 250 requests/minute
- **Advanced**: Unlimited

#### Cost

- **Free**: 5 requests/minute
- **Starter**: $199/month (100 req/min)
- **Developer**: $399/month (250 req/min)
- **Advanced**: $999/month (unlimited)

#### Troubleshooting

- **Error: Rate limit exceeded**: Implement request queuing
- **Delayed data**: Free tier has 15-minute delay
- **Missing data**: Some data requires higher tier plans

## Configuration

### Advanced Configuration

```typescript
import { DiligenceClient, MCPServerManager } from 'diligence-cubed';

const mcpConfig = {
  servers: {
    alphavantage: {
      apiKey: process.env.ALPHAVANTAGE_API_KEY,
      rateLimit: { requests: 500, period: 'day' },
      timeout: 30000,
      retryOptions: {
        maxRetries: 3,
        backoff: 'exponential',
        initialDelay: 1000
      }
    },
    exa: {
      apiKey: process.env.EXA_API_KEY,
      rateLimit: { requests: 1000, period: 'month' },
      timeout: 60000,
      retryOptions: {
        maxRetries: 2,
        backoff: 'linear'
      }
    }
  },
  cache: {
    enabled: true,
    storage: 'redis',
    ttl: 3600,
    keyPrefix: 'mcp:'
  },
  fallbacks: {
    alphavantage: ['polygon'],
    exa: ['perplexity']
  },
  logging: {
    level: 'info',
    includeRequests: true,
    includeResponses: false
  }
};

const client = new DiligenceClient({
  apiKey: 'your-api-key',
  mcpServers: mcpConfig
});
```

### Environment-Specific Configuration

```typescript
// config/production.ts
export const productionConfig = {
  mcpServers: {
    alphavantage: {
      apiKey: process.env.ALPHAVANTAGE_API_KEY,
      rateLimit: { requests: 1200, period: 'minute' }  // Premium tier
    }
  },
  cache: {
    enabled: true,
    storage: 'redis',
    ttl: 7200
  }
};

// config/development.ts
export const developmentConfig = {
  mcpServers: {
    alphavantage: {
      apiKey: process.env.ALPHAVANTAGE_API_KEY,
      rateLimit: { requests: 5, period: 'minute' }  // Free tier
    }
  },
  cache: {
    enabled: true,
    storage: 'memory',
    ttl: 600
  }
};
```

## Rate Limits and Costs

### Monthly Cost Estimation

For a typical due diligence workload (10 companies/month, standard depth):

| MCP Server | Free Tier | Recommended Plan | Monthly Cost |
|------------|-----------|------------------|--------------|
| AlphaVantage | 500/day | Professional | $250 |
| Exa.ai | 1,000/month | Professional | $500 |
| Perplexity | Usage-based | Pay-as-you-go | $100 |
| GitHub | 5,000/hour | Free | $0 |
| NewsAPI | 100/day | Business | $999 |
| Polygon.io | 5/min | Starter | $199 |
| **Total** | - | - | **~$2,048/month** |

### Cost Optimization Strategies

1. **Use Caching Aggressively**: Cache MCP responses for 1-24 hours
2. **Batch Requests**: Combine multiple queries when possible
3. **Free Tier for Development**: Use free tiers during development
4. **Prioritize Critical Data**: Focus expensive queries on critical analysis
5. **Implement Fallbacks**: Use cheaper alternatives when primary fails

### Rate Limit Management

```typescript
class RateLimiter {
  private counters: Map<string, number>;
  private resetTimes: Map<string, Date>;

  async checkLimit(server: string): Promise<boolean> {
    const limit = this.limits.get(server);
    const count = this.counters.get(server) || 0;

    if (count >= limit.requests) {
      const resetTime = this.resetTimes.get(server);
      if (new Date() < resetTime) {
        return false;  // Rate limit exceeded
      }
      // Reset counter
      this.counters.set(server, 0);
      this.resetTimes.set(server, this.calculateResetTime(limit.period));
    }

    return true;
  }

  async increment(server: string): Promise<void> {
    const count = this.counters.get(server) || 0;
    this.counters.set(server, count + 1);
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Symptom**: 401 Unauthorized or 403 Forbidden

**Solutions**:
- Verify API key is correct and not expired
- Check that API key has required permissions
- Ensure key is properly loaded from environment variables

```typescript
// Debug authentication
console.log('API Key:', process.env.ALPHAVANTAGE_API_KEY?.substring(0, 5) + '...');
```

#### 2. Rate Limit Errors

**Symptom**: 429 Too Many Requests

**Solutions**:
- Implement request queuing
- Add delays between requests
- Upgrade to higher tier plan
- Use caching to reduce requests

```typescript
// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

#### 3. Timeout Errors

**Symptom**: Request timeout or ECONNABORTED

**Solutions**:
- Increase timeout value
- Check network connectivity
- Verify MCP server is operational

```typescript
// Increase timeout
{
  mcpServers: {
    exa: {
      timeout: 120000  // 2 minutes for deep searches
    }
  }
}
```

#### 4. Empty or Invalid Responses

**Symptom**: No data returned or malformed JSON

**Solutions**:
- Verify query parameters are correct
- Check data availability for requested period
- Review MCP server documentation for changes

```typescript
// Add response validation
function validateResponse(response: any): boolean {
  if (!response || !response.data) {
    console.error('Invalid response:', response);
    return false;
  }
  return true;
}
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const client = new DiligenceClient({
  apiKey: 'your-api-key',
  mcpServers: {
    // ... server config
  },
  logging: {
    level: 'debug',
    includeRequests: true,
    includeResponses: true
  }
});
```

## Best Practices

### 1. API Key Management

- **Never commit API keys**: Use environment variables
- **Rotate keys regularly**: Update keys every 90 days
- **Use separate keys**: Different keys for dev/staging/prod
- **Monitor usage**: Track API usage against quotas

### 2. Caching Strategy

- **Cache aggressively**: Most financial data changes infrequently
- **Use appropriate TTLs**:
  - Company info: 24 hours
  - Financial data: 1 hour during market hours, 12 hours after close
  - News: 15 minutes
  - Real-time data: 1 minute

### 3. Error Handling

- **Implement retries**: Use exponential backoff
- **Have fallbacks**: Configure alternative data sources
- **Log errors**: Track failures for analysis
- **Graceful degradation**: Continue analysis with partial data

### 4. Performance Optimization

- **Batch requests**: Combine multiple queries
- **Parallel processing**: Query multiple servers simultaneously
- **Lazy loading**: Only fetch data when needed
- **Connection pooling**: Reuse HTTP connections

### 5. Cost Management

- **Monitor spending**: Track API costs daily
- **Set budgets**: Alert when approaching limits
- **Optimize queries**: Reduce unnecessary requests
- **Review plans**: Adjust tiers based on usage

## Support and Resources

### Official Documentation

- AlphaVantage: https://www.alphavantage.co/documentation/
- Exa.ai: https://docs.exa.ai/
- Perplexity: https://docs.perplexity.ai/
- GitHub API: https://docs.github.com/en/rest
- NewsAPI: https://newsapi.org/docs
- Polygon.io: https://polygon.io/docs

### Community Support

- GitHub Issues: https://github.com/your-org/diligence-cubed/issues
- Discord: https://discord.gg/diligence-cubed
- Stack Overflow: Tag `diligence-cubed`

### Professional Support

For enterprise support with MCP integration:
- Email: support@diligence-cubed.com
- Slack Connect: Available for enterprise customers
