# API Documentation

Complete API reference for Diligence Cubed platform.

## Table of Contents

- [Client Library](#client-library)
- [REST API](#rest-api)
- [WebSocket API](#websocket-api)
- [Agent Classes](#agent-classes)
- [Type Definitions](#type-definitions)
- [MCP Integration Interfaces](#mcp-integration-interfaces)
- [Configuration Options](#configuration-options)

## Client Library

### DiligenceClient

Main client class for interacting with the Diligence Cubed platform.

#### Constructor

```typescript
new DiligenceClient(config: ClientConfig)
```

**Parameters:**

- `config.apiKey` (string, required): API authentication key
- `config.baseUrl` (string, optional): API base URL (default: https://api.diligence-cubed.com)
- `config.mcpServers` (object, required): MCP server API keys
- `config.timeout` (number, optional): Request timeout in milliseconds (default: 300000)
- `config.retryOptions` (object, optional): Retry configuration

**Example:**

```typescript
const client = new DiligenceClient({
  apiKey: 'your-api-key',
  mcpServers: {
    alphavantage: process.env.ALPHAVANTAGE_KEY,
    exa: process.env.EXA_KEY,
  },
  timeout: 300000,
  retryOptions: {
    maxRetries: 3,
    backoff: 'exponential'
  }
});
```

#### Methods

##### startDiligence()

Initiates a new due diligence analysis.

```typescript
async startDiligence(options: DiligenceOptions): Promise<DiligenceResult>
```

**Parameters:**

```typescript
interface DiligenceOptions {
  companyName: string;           // Target company name
  companyDomain: string;         // Company primary domain
  type: DiligenceType;           // 'full' | 'financial' | 'commercial' | 'technical'
  depth?: ResearchDepth;         // 'standard' | 'deep' | 'exhaustive' (default: 'standard')
  priority?: Priority;           // 'normal' | 'high' | 'critical' (default: 'normal')
  webhookUrl?: string;           // Webhook for updates
  webhookEvents?: string[];      // Events to trigger webhook
  focus?: string[];              // Specific areas to emphasize
  agents?: AgentConfig;          // Custom agent configurations
  metadata?: Record<string, any>; // Additional metadata
}
```

**Returns:**

```typescript
interface DiligenceResult {
  id: string;                    // Unique diligence ID
  status: DiligenceStatus;       // Current status
  estimatedCompletion: Date;     // Estimated completion time
  createdAt: Date;               // Creation timestamp
  agents: string[];              // List of active agents
}
```

**Example:**

```typescript
const diligence = await client.startDiligence({
  companyName: 'Acme Corp',
  companyDomain: 'acme.com',
  type: 'full',
  depth: 'deep',
  webhookUrl: 'https://myapp.com/webhooks/diligence',
  webhookEvents: ['completed', 'red_flag']
});
```

##### getStatus()

Retrieves the current status of a diligence analysis.

```typescript
async getStatus(diligenceId: string): Promise<DiligenceStatus>
```

**Returns:**

```typescript
interface DiligenceStatus {
  id: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  progress: number;              // 0-100
  currentStage: string;
  agentsActive: string[];
  agentsCompleted: string[];
  findings: number;
  redFlags: number;
  startedAt: Date;
  estimatedCompletion: Date;
  completedAt?: Date;
}
```

##### getReport()

Retrieves the final report for a completed diligence.

```typescript
async getReport(diligenceId: string, options?: ReportOptions): Promise<Report>
```

**Parameters:**

```typescript
interface ReportOptions {
  format?: 'json' | 'pdf' | 'excel';  // Report format (default: 'json')
  sections?: string[];                // Specific sections to include
  includeRawData?: boolean;           // Include raw data points
  includeSourceLinks?: boolean;       // Include source URLs
}
```

**Returns:**

```typescript
interface Report {
  id: string;
  company: CompanyInfo;
  executiveSummary: ExecutiveSummary;
  financialAnalysis: FinancialAnalysis;
  marketAnalysis: MarketAnalysis;
  competitiveAnalysis: CompetitiveAnalysis;
  productAnalysis?: TechnicalAnalysis;
  customerAnalysis: CustomerAnalysis;
  riskAssessment: RiskAssessment;
  recommendations: Recommendations;
  generatedAt: Date;
  format: string;
  metadata: ReportMetadata;
}
```

##### subscribe()

Subscribe to real-time updates for a diligence analysis.

```typescript
subscribe(diligenceId: string, callback: UpdateCallback): Subscription
```

**Parameters:**

```typescript
type UpdateCallback = (update: DiligenceUpdate) => void;

interface DiligenceUpdate {
  id: string;
  type: 'status' | 'finding' | 'red_flag' | 'milestone' | 'completion';
  agent?: string;
  timestamp: Date;
  data: any;
}
```

**Returns:**

```typescript
interface Subscription {
  unsubscribe(): void;
  isActive(): boolean;
}
```

**Example:**

```typescript
const subscription = client.subscribe(diligenceId, (update) => {
  if (update.type === 'red_flag') {
    console.log(`Red flag detected: ${update.data.description}`);
  }
});

// Later...
subscription.unsubscribe();
```

##### cancel()

Cancels an ongoing diligence analysis.

```typescript
async cancel(diligenceId: string): Promise<void>
```

## REST API

Base URL: `https://api.diligence-cubed.com/v1`

### Authentication

All API requests require authentication using an API key in the header:

```
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

#### POST /diligence

Initiate a new diligence analysis.

**Request:**

```json
{
  "company_name": "Acme Corp",
  "company_domain": "acme.com",
  "diligence_type": "full",
  "depth": "standard",
  "priority": "normal",
  "webhook_url": "https://example.com/webhook"
}
```

**Response:**

```json
{
  "diligence_id": "ddl_1234567890abcdef",
  "status": "initiated",
  "estimated_completion": "2025-11-10T23:00:00Z",
  "created_at": "2025-11-10T19:00:00Z"
}
```

#### GET /diligence/:id/status

Get the status of a diligence analysis.

**Response:**

```json
{
  "diligence_id": "ddl_1234567890abcdef",
  "status": "in_progress",
  "progress": 65,
  "current_stage": "financial_analysis",
  "agents_active": ["financial", "market", "competitive"],
  "agents_completed": ["orchestrator"],
  "findings": 42,
  "red_flags": 2,
  "started_at": "2025-11-10T19:00:00Z",
  "estimated_completion": "2025-11-10T23:00:00Z"
}
```

#### GET /diligence/:id/results

Get the results of a completed diligence.

**Query Parameters:**

- `format`: `json`, `pdf`, or `excel` (default: `json`)
- `sections`: Comma-separated list of sections to include

**Response:**

```json
{
  "diligence_id": "ddl_1234567890abcdef",
  "company": {
    "name": "Acme Corp",
    "domain": "acme.com",
    "industry": "Software",
    "founded": 2015
  },
  "executive_summary": {
    "recommendation": "proceed_with_conditions",
    "key_strengths": [...],
    "key_concerns": [...],
    "valuation_range": {
      "low": 50000000,
      "high": 75000000
    }
  },
  "financial_analysis": {...},
  "market_analysis": {...},
  "competitive_analysis": {...},
  "risk_assessment": {...}
}
```

#### GET /diligence/:id/findings

Get specific findings from the analysis.

**Query Parameters:**

- `type`: Filter by finding type (e.g., `red_flag`, `opportunity`)
- `agent`: Filter by agent name
- `limit`: Maximum number of findings to return
- `offset`: Pagination offset

**Response:**

```json
{
  "findings": [
    {
      "id": "finding_abc123",
      "type": "red_flag",
      "agent": "financial",
      "severity": "high",
      "title": "Declining gross margins",
      "description": "Gross margins have declined from 75% to 62% over the past 3 years",
      "evidence": [...],
      "recommendations": [...]
    }
  ],
  "total": 42,
  "page": 1,
  "has_more": true
}
```

#### POST /diligence/:id/cancel

Cancel an ongoing diligence analysis.

**Response:**

```json
{
  "diligence_id": "ddl_1234567890abcdef",
  "status": "cancelled",
  "cancelled_at": "2025-11-10T20:30:00Z"
}
```

## WebSocket API

Connect to receive real-time updates for a diligence analysis.

**URL:** `wss://api.diligence-cubed.com/v1/diligence/:id/stream`

**Authentication:** Include API key in connection headers or query parameter

```javascript
const ws = new WebSocket(
  'wss://api.diligence-cubed.com/v1/diligence/ddl_123/stream',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Update:', update);
};
```

**Message Format:**

```json
{
  "type": "finding",
  "agent": "financial",
  "timestamp": "2025-11-10T19:30:00Z",
  "data": {
    "title": "Strong revenue growth",
    "description": "Revenue has grown 150% YoY",
    "severity": "positive"
  }
}
```

## Agent Classes

### OrchestratorAgent

Master coordinator responsible for workflow management.

```typescript
class OrchestratorAgent extends BaseAgent {
  async planResearch(company: string, scope: DiligenceScope): Promise<ResearchPlan>;
  async delegateTasks(plan: ResearchPlan): Promise<Task[]>;
  async validateFindings(results: AgentResult[]): Promise<ValidationReport>;
  async identifyGaps(validated: ValidationReport): Promise<ResearchGap[]>;
  async synthesizeResults(allResults: Record<string, any>): Promise<FinalReport>;
}
```

### FinancialAgent

Performs comprehensive financial analysis.

```typescript
class FinancialAgent extends BaseAgent {
  async analyzeRevenue(company: CompanyData): Promise<RevenueAnalysis>;
  async analyzeProfitability(company: CompanyData): Promise<ProfitabilityAnalysis>;
  async performValuation(company: CompanyData): Promise<ValuationAnalysis>;
  async analyzeUnitEconomics(company: CompanyData): Promise<UnitEconomics>;
  async assessFinancialHealth(company: CompanyData): Promise<FinancialHealth>;
}
```

### MarketAgent

Analyzes market opportunity and industry dynamics.

```typescript
class MarketAgent extends BaseAgent {
  async calculateMarketSize(industry: string): Promise<MarketSizing>;
  async analyzeGrowthDrivers(market: MarketData): Promise<GrowthAnalysis>;
  async assessIndustryStructure(industry: string): Promise<IndustryStructure>;
  async evaluateRegulatoryLandscape(industry: string): Promise<RegulatoryAnalysis>;
}
```

### CompetitiveAgent

Analyzes competitive landscape and positioning.

```typescript
class CompetitiveAgent extends BaseAgent {
  async identifyCompetitors(company: CompanyData): Promise<Competitor[]>;
  async analyzeCompetitivePosition(company: CompanyData): Promise<PositionAnalysis>;
  async assessMoat(company: CompanyData): Promise<MoatAssessment>;
  async evaluateDisruptionRisk(company: CompanyData): Promise<DisruptionRisk>;
}
```

### TechnicalAgent

Evaluates product and technology.

```typescript
class TechnicalAgent extends BaseAgent {
  async analyzeArchitecture(company: CompanyData): Promise<ArchitectureReview>;
  async assessCodeQuality(repos: Repository[]): Promise<CodeQualityReport>;
  async evaluateTechStack(company: CompanyData): Promise<TechStackAnalysis>;
  async measureEngineeringEfficiency(data: EngineeringData): Promise<EngineeringMetrics>;
}
```

### CustomerAgent

Analyzes customer dynamics and revenue quality.

```typescript
class CustomerAgent extends BaseAgent {
  async analyzeCustomerConcentration(customers: CustomerData[]): Promise<ConcentrationAnalysis>;
  async analyzeRetention(cohorts: CohortData[]): Promise<RetentionAnalysis>;
  async assessSalesEfficiency(salesData: SalesData): Promise<SalesEfficiency>;
  async evaluateCustomerSatisfaction(reviews: Review[]): Promise<SatisfactionAnalysis>;
}
```

### NewsAgent

Monitors news and sentiment.

```typescript
class NewsAgent extends BaseAgent {
  async monitorNews(company: string, since: Date): Promise<NewsItem[]>;
  async analyzeSentiment(content: string[]): Promise<SentimentAnalysis>;
  async detectRedFlags(news: NewsItem[]): Promise<RedFlag[]>;
  async trackReputation(company: string): Promise<ReputationScore>;
}
```

### RiskAgent

Identifies and quantifies risks.

```typescript
class RiskAgent extends BaseAgent {
  async identifyRisks(company: CompanyData, analysis: AnalysisData): Promise<Risk[]>;
  async scoreRisk(risk: Risk): Promise<RiskScore>;
  async recommendMitigations(risks: Risk[]): Promise<Mitigation[]>;
  async generateRiskMatrix(risks: Risk[]): Promise<RiskMatrix>;
}
```

### SynthesisAgent

Generates final reports and deliverables.

```typescript
class SynthesisAgent extends BaseAgent {
  async generateInvestmentMemo(data: AnalysisData): Promise<InvestmentMemo>;
  async generateRedFlagReport(redFlags: RedFlag[]): Promise<RedFlagReport>;
  async createDashboard(data: AnalysisData): Promise<Dashboard>;
  async exportToFormat(report: Report, format: string): Promise<Buffer>;
}
```

## Type Definitions

### Core Types

```typescript
type DiligenceType = 'full' | 'financial' | 'commercial' | 'technical';
type ResearchDepth = 'standard' | 'deep' | 'exhaustive';
type Priority = 'normal' | 'high' | 'critical';
type DiligenceStatusType = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

interface CompanyInfo {
  name: string;
  domain: string;
  industry: string;
  founded?: number;
  headquarters?: string;
  employeeCount?: number;
  description?: string;
}

interface ExecutiveSummary {
  recommendation: 'strong_buy' | 'proceed_with_conditions' | 'pass' | 'requires_deep_dive';
  keyStrengths: string[];
  keyConcerns: string[];
  valuationRange: {
    low: number;
    high: number;
    currency: string;
  };
  investmentThesis: string;
  criticalRisks: string[];
}

interface FinancialAnalysis {
  revenueMetrics: {
    currentRevenue: number;
    growthRate: number;
    revenueQuality: number;  // 0-100 score
    historicalRevenue: TimeSeries;
  };
  profitability: {
    grossMargin: number;
    ebitdaMargin: number;
    netMargin: number;
    fcfConversion: number;
  };
  valuation: {
    enterpriseValue: number;
    evRevenueMultiple: number;
    dcfValuation: number;
    comparablesRange: { low: number; high: number };
  };
  redFlags: Finding[];
  opportunities: Finding[];
}

interface MarketAnalysis {
  marketSize: {
    tam: number;
    sam: number;
    som: number;
    growthRate: number;
    methodology: string;
  };
  growthDrivers: string[];
  industryStructure: {
    concentration: string;
    barriersToEntry: string;
    buyerPower: string;
    supplierPower: string;
  };
  regulatoryRisks: Risk[];
}

interface CompetitiveAnalysis {
  competitors: Competitor[];
  positioning: {
    competitiveAdvantages: string[];
    competitiveDisadvantages: string[];
    marketShare: number;
    moatStrength: number;  // 0-100 score
  };
  disruptionRisk: {
    level: 'low' | 'medium' | 'high';
    sources: string[];
    mitigations: string[];
  };
}

interface TechnicalAnalysis {
  architecture: {
    scalability: number;  // 0-100 score
    reliability: number;
    security: number;
    technicalDebt: string;
  };
  codeQuality: {
    testCoverage: number;
    bugRate: number;
    maintainability: number;
  };
  engineeringMetrics: {
    releaseFrequency: string;
    deploymentSuccess: number;
    meanTimeToRecover: number;
  };
}

interface CustomerAnalysis {
  concentration: {
    top10Revenue: number;
    herfindahlIndex: number;
    keyAccountRisks: string[];
  };
  retention: {
    grossRetention: number;
    netRetention: number;
    churnRate: number;
    cohortAnalysis: CohortData[];
  };
  satisfaction: {
    nps: number;
    reviewScore: number;
    supportMetrics: SupportMetrics;
  };
}

interface RiskAssessment {
  risks: Risk[];
  overallRiskScore: number;  // 0-100
  criticalRisks: Risk[];
  riskMatrix: RiskMatrix;
  mitigationRecommendations: Mitigation[];
}

interface Risk {
  id: string;
  category: 'execution' | 'market' | 'technology' | 'financial' | 'regulatory' | 'integration';
  title: string;
  description: string;
  probability: number;  // 0-1
  impact: number;       // 0-10
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigations: string[];
}

interface Finding {
  id: string;
  type: 'red_flag' | 'opportunity' | 'neutral';
  agent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: Evidence[];
  recommendations: string[];
  confidence: number;  // 0-100
}

interface Competitor {
  name: string;
  domain: string;
  description: string;
  marketShare?: number;
  strengths: string[];
  weaknesses: string[];
  positioning: string;
}
```

## MCP Integration Interfaces

### MCPServerManager

Manages connections to MCP servers.

```typescript
class MCPServerManager {
  constructor(config: MCPConfig);

  async query(server: string, query: Query): Promise<Response>;
  async batchQuery(queries: BatchQuery[]): Promise<Response[]>;
  getServerStatus(server: string): ServerStatus;
  refreshCredentials(server: string): Promise<void>;
}

interface MCPConfig {
  servers: {
    [serverName: string]: {
      apiKey: string;
      rateLimit?: RateLimit;
      timeout?: number;
      retryOptions?: RetryOptions;
    };
  };
  cache?: CacheConfig;
  fallbacks?: FallbackConfig;
}

interface Query {
  method: string;
  params: Record<string, any>;
  priority?: number;
  cacheKey?: string;
  cacheTTL?: number;
  forceRefresh?: boolean;
}

interface ServerStatus {
  name: string;
  status: 'active' | 'degraded' | 'down';
  rateLimitRemaining: number;
  rateLimitReset: Date;
  lastError?: Error;
}
```

## Configuration Options

### Client Configuration

```typescript
interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  mcpServers: MCPServerConfig;
  timeout?: number;
  retryOptions?: RetryOptions;
  cache?: CacheConfig;
  logging?: LoggingConfig;
}

interface MCPServerConfig {
  alphavantage: string;
  exa: string;
  perplexity?: string;
  github?: string;
  newsapi?: string;
  polygon?: string;
}

interface RetryOptions {
  maxRetries: number;
  backoff: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
}

interface CacheConfig {
  enabled: boolean;
  storage: 'memory' | 'redis' | 'file';
  ttl: number;
  maxSize?: number;
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destination?: string;
}
```

### Agent Configuration

```typescript
interface AgentConfig {
  [agentName: string]: {
    enabled?: boolean;
    timeout?: number;
    maxRetries?: number;
    customPrompts?: Record<string, string>;
    dataSources?: string[];
    focus?: string[];
  };
}
```

### Diligence Configuration

```typescript
interface DiligenceConfig {
  type: DiligenceType;
  depth: ResearchDepth;
  priority: Priority;
  agents?: AgentConfig;
  focus?: string[];
  excludeAreas?: string[];
  timeline?: {
    maxDuration?: number;
    milestones?: Milestone[];
  };
  output?: {
    format: 'json' | 'pdf' | 'excel';
    sections?: string[];
    includeRawData?: boolean;
  };
}
```

## Error Handling

All API methods can throw the following error types:

```typescript
class DiligenceError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

class AuthenticationError extends DiligenceError {
  code = 'AUTHENTICATION_ERROR';
  statusCode = 401;
}

class RateLimitError extends DiligenceError {
  code = 'RATE_LIMIT_ERROR';
  statusCode = 429;
  retryAfter: number;
}

class ValidationError extends DiligenceError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  errors: ValidationErrorDetail[];
}

class NotFoundError extends DiligenceError {
  code = 'NOT_FOUND';
  statusCode = 404;
}

class ServerError extends DiligenceError {
  code = 'SERVER_ERROR';
  statusCode = 500;
}
```

**Example Error Handling:**

```typescript
try {
  const diligence = await client.startDiligence(options);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ValidationError) {
    console.log('Validation errors:', error.errors);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Rate Limits

- **Standard Plan**: 100 requests/hour
- **Professional Plan**: 500 requests/hour
- **Enterprise Plan**: Unlimited

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699632000
```

## Versioning

The API uses semantic versioning. Current version: `v1`

Breaking changes will be introduced in new major versions (e.g., `v2`).

## Support

For API support, please contact:
- Email: api-support@diligence-cubed.com
- Documentation: https://docs.diligence-cubed.com
- Status Page: https://status.diligence-cubed.com
