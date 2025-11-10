/**
 * Type definitions for MCP (Model Context Protocol) integrations
 */

export type MCPServerType =
  | 'alphavantage'
  | 'polygon'
  | 'exa'
  | 'perplexity'
  | 'github'
  | 'newsapi'
  | 'brave_search';

export interface MCPServer {
  type: MCPServerType;
  name: string;
  baseUrl: string;
  apiKey: string;
  rateLimit: RateLimit;
  status: 'connected' | 'disconnected' | 'error';
}

export interface RateLimit {
  requestsPerPeriod: number;
  period: 'second' | 'minute' | 'hour' | 'day' | 'month';
  currentUsage: number;
  resetAt: Date;
}

export interface MCPQuery {
  server: MCPServerType;
  endpoint: string;
  parameters: Record<string, unknown>;
  priority: number;
  cacheKey?: string;
  cacheTTL?: number;
  forceRefresh?: boolean;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  server?: MCPServerType;
  data?: T;
  error?: MCPError;
  cached: boolean;
  timestamp: Date;
  rateLimit?: RateLimit;
  requestId?: string;
  source?: string;
}

// MCPErrorType as enum so it can be used as both type and value
export enum MCPErrorType {
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  NOT_FOUND = 'not_found',
  INVALID_REQUEST = 'invalid_request',
  UNKNOWN = 'unknown',
}

export interface MCPError {
  type: MCPErrorType;
  server: MCPServerType;
  errorType: MCPErrorType;
  message: string;
  retryable: boolean;
  retryAfter?: number; // Changed from Date to number (timestamp)
  timestamp?: Date;
}

// Financial Data Types (AlphaVantage, Polygon)
export interface FinancialData {
  symbol: string;
  fundamentals?: CompanyFundamentals;
  priceData?: PriceData[];
  earnings?: EarningsData[];
}

export interface CompanyFundamentals {
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  revenue?: number;
  profitMargin?: number;
  operatingMargin?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  debtToEquity?: number;
  currentRatio?: number;
}

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EarningsData {
  fiscalDateEnding: string;
  reportedEPS: number;
  estimatedEPS: number;
  surprise: number;
  surprisePercentage: number;
}

// Search Data Types (Exa, Perplexity, Brave)
export interface SearchQuery {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startDate?: string;
  endDate?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
  score?: number;
}

// GitHub Data Types
export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language?: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface CodeQualityMetrics {
  totalCommits: number;
  contributors: number;
  averageCommitsPerWeek: number;
  codeChurn: number;
  testCoverage?: number;
  linesOfCode: number;
  programmingLanguages: Record<string, number>;
}

// News Data Types
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  author?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  relevanceScore?: number;
}

// MCP Server Config Types
export interface ExaConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ExaSearchParams {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  useAutoprompt?: boolean;
  type?: 'neural' | 'keyword';
  contents?: {
    text?: boolean;
    highlights?: boolean;
    summary?: boolean;
  };
}

export interface ExaSearchResponse {
  results: Array<{
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score?: number;
    id?: string;
    text?: string;
    highlights?: string[];
    summary?: string;
  }>;
  autopromptString?: string;
}

export interface GitHubConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface GitHubRepoParams {
  owner: string;
  repo: string;
}

export interface GitHubRepoInfo {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  size: number;
  license?: {
    key: string;
    name: string;
  };
  topics: string[];
}

export interface GitHubCodeQualityMetrics {
  totalCommits: number;
  contributors: number;
  avgCommitsPerWeek: number;
  openIssuesCount: number;
  closedIssuesCount: number;
  pullRequests: {
    open: number;
    closed: number;
    merged: number;
  };
  codeFrequency: {
    additions: number;
    deletions: number;
  };
  languages: Record<string, number>;
}

export interface NewsAPIConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface NewsAPISearchParams {
  query?: string;
  q?: string; // Alias for query
  from?: string;
  to?: string;
  language?: string;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  pageSize?: number;
  page?: number;
  sources?: string;
  domains?: string;
}

export type NewsAPIArticle = NewsArticle;

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

export interface PerplexityConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface PerplexitySearchParams {
  query: string;
  searchDomainFilter?: string[];
  search_domain_filter?: string[]; // Snake case alias
  returnImages?: boolean;
  return_images?: boolean; // Snake case alias
  returnRelatedQuestions?: boolean;
  return_citations?: boolean;
  searchRecencyFilter?: string;
  search_recency_filter?: string; // Snake case alias
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface PerplexitySearchResponse {
  answer: string;
  citations: string[];
  images?: string[];
  relatedQuestions?: string[];
}

export interface PolygonConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface PolygonTickerParams {
  ticker: string;
}

export interface PolygonAggregatesParams {
  ticker: string;
  multiplier: number;
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  from: string;
  to: string;
  adjusted?: boolean;
  sort?: 'asc' | 'desc';
  limit?: number;
}

export interface PolygonAggregate {
  v: number;  // volume
  vw: number; // volume weighted average price
  o: number;  // open
  c: number;  // close
  h: number;  // high
  l: number;  // low
  t: number;  // timestamp
  n: number;  // number of items in aggregate
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string;
  active: boolean;
  currency_name?: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  market_cap?: number;
  phone_number?: string;
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
  share_class_shares_outstanding?: number;
  weighted_shares_outstanding?: number;
}

// Additional MCP Types
export interface CacheConfig {
  enabled: boolean;
  redisUrl?: string;
  defaultTTL?: number;
  maxMemorySize?: number;
}

export interface MCPRequest {
  id?: string;
  server: MCPServerType;
  method: string;
  endpoint?: string;
  params?: Record<string, unknown>;
  cacheKey?: string;
  cacheTTL?: number;
  cacheConfig?: { ttl?: number };
  priority?: number;
  timeout?: number;
  skipCache?: boolean;
}

export interface MCPServerConfig {
  type: MCPServerType;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: RateLimitConfig;
  fallbackServers?: string[];
}

export interface MCPManagerConfig {
  servers: Record<string, MCPServerConfig>;
  redisUrl?: string;
  defaultCacheTTL?: number;
  enableMetrics?: boolean;
  enableCache?: boolean;
}

export interface MCPManagerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  serverStats: Record<string, {
    requests: number;
    successes: number;
    failures: number;
    avgResponseTime: number;
  }>;
}

export interface ServerState {
  status: 'connected' | 'disconnected' | 'error';
  available?: boolean;
  lastRequest?: Date;
  lastError?: MCPError;
  consecutiveErrors: number;
  totalRequests: number;
  requestCount?: number;
  successfulRequests: number;
  failedRequests: number;
  errorCount?: number;
  avgResponseTime?: number;
}

export interface RateLimitConfig {
  requestsPerPeriod: number;
  requestsPerInterval?: number; // Alias for requestsPerPeriod
  period: 'second' | 'minute' | 'hour' | 'day';
  interval?: number; // Interval in milliseconds
  burstLimit?: number;
  concurrentRequests?: number;
}

// AlphaVantage specific types
export interface AlphaVantageConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AlphaVantageTimeSeriesParams {
  symbol: string;
  interval?: '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly';
  outputsize?: 'compact' | 'full';
  function?: string; // AlphaVantage API function parameter
}

export interface AlphaVantageFundamentalsParams {
  symbol: string;
}

export interface AlphaVantageOverview {
  Symbol: string;
  AssetType: string;
  Name: string;
  Description: string;
  CIK: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  Address: string;
  MarketCapitalization: string;
  EBITDA: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  RevenuePerShareTTM: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  DilutedEPSTTM: string;
  QuarterlyEarningsGrowthYOY: string;
  QuarterlyRevenueGrowthYOY: string;
  AnalystTargetPrice: string;
  TrailingPE: string;
  ForwardPE: string;
  PriceToSalesRatioTTM: string;
  PriceToBookRatio: string;
  EVToRevenue: string;
  EVToEBITDA: string;
  Beta: string;
  '52WeekHigh': string;
  '52WeekLow': string;
  '50DayMovingAverage': string;
  '200DayMovingAverage': string;
  SharesOutstanding: string;
  DividendDate: string;
  ExDividendDate: string;
}
