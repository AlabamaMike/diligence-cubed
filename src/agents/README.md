# Agent System Architecture

This directory contains the implementation of the 9 specialized agents for the Agentic Due Diligence Platform.

## Overview

The agent system is built on a base agent class that provides common functionality including:
- Error handling and retry logic with exponential backoff
- Execution timeouts
- Metrics tracking (execution time, data points, sources, confidence)
- Consistent result formatting
- Logging capabilities

## Agent Hierarchy

```
BaseAgent (abstract)
├── OrchestratorAgent
├── FinancialAnalysisAgent
├── MarketIndustryAgent
├── CompetitiveIntelligenceAgent
├── ProductTechnologyAgent
├── CustomerRevenueAgent
├── NewsSentimentAgent
├── RiskAssessmentAgent
└── SynthesisReportingAgent
```

## Agents

### 1. OrchestratorAgent (`orchestrator.ts`)

**Purpose**: Master coordinator for workflow management

**Key Methods**:
- `planResearch()` - Creates research plan with task dependencies
- `delegateTasks()` - Distributes tasks to specialized agents
- `validateFindings()` - Cross-validates results from multiple agents
- `identifyGaps()` - Identifies research gaps requiring follow-up
- `synthesizeResults()` - Combines all results into final report

**Decision Logic**:
- Routes to appropriate specialized agents based on scope
- Manages task dependencies and execution order
- Performs quality gates and cross-validation
- Escalates red flags for human review

### 2. FinancialAnalysisAgent (`financial.ts`)

**Purpose**: Comprehensive financial analysis and modeling

**Data Sources**:
- AlphaVantage MCP (fundamentals, earnings)
- SEC EDGAR (filings)
- Exa.ai (analyst reports)

**Core Analyses**:
- Revenue metrics and growth trends
- Profitability analysis (margins, cash flow)
- Balance sheet health
- Valuation (DCF, comparables)
- Unit economics (CAC, LTV)
- Scenario analysis (bull/base/bear cases)

**Output**: `FinancialSummary` with comprehensive financial metrics

### 3. MarketIndustryAgent (`market.ts`)

**Purpose**: TAM analysis, industry dynamics, and growth drivers

**Research Framework**:
- Market sizing (TAM/SAM/SOM)
- Growth drivers identification
- Industry structure analysis (5 forces)
- Regulatory landscape assessment
- Economic sensitivity analysis
- Market trend identification

**Output**: `MarketAnalysis` with market opportunity assessment

### 4. CompetitiveIntelligenceAgent (`competitive.ts`)

**Purpose**: Competitive positioning and differentiation analysis

**Analysis Dimensions**:
- Competitive mapping (direct, indirect, potential competitors)
- Positioning analysis (differentiators, pricing, go-to-market)
- Market share dynamics
- Moat assessment (network effects, switching costs, brand)
- Disruption risk analysis

**Intelligence Sources**:
- Web scraping, review mining, job postings, patent analysis

**Output**: `CompetitiveAnalysis` with competitive landscape

### 5. ProductTechnologyAgent (`technology.ts`)

**Purpose**: Technical architecture and product evaluation

**Technical Assessment**:
- Architecture review (scalability, reliability, maintainability)
- Code quality metrics (test coverage, complexity, technical debt)
- Tech stack analysis (languages, frameworks, infrastructure)
- Security posture assessment
- Engineering metrics (velocity, release frequency)
- Innovation metrics (R&D efficiency, patents)

**For Software Companies**:
- GitHub repository analysis
- Dependency risk assessment
- Development velocity tracking

**Output**: `TechnologyAssessment` with technical evaluation

### 6. CustomerRevenueAgent (`customer.ts`)

**Purpose**: Customer dynamics and revenue quality analysis

**Core Metrics**:
- Customer concentration (Herfindahl index, top customer dependencies)
- Retention analysis (gross/net retention, cohort analysis)
- Sales efficiency (CAC trends, sales cycle, win rates)
- Expansion revenue (upsell/cross-sell rates)
- Customer satisfaction (NPS, reviews, support metrics)
- Revenue quality scoring

**Output**: `CustomerAnalysis` with customer and revenue insights

### 7. NewsSentimentAgent (`news.ts`)

**Purpose**: Real-time monitoring and reputation analysis

**Monitoring Scope**:
- Management changes and key personnel movements
- Litigation and regulatory actions
- Partnership announcements
- Customer wins/losses
- ESG considerations
- Social media sentiment

**Alert Triggers**:
- Executive departures
- Regulatory investigations
- Major customer churn
- Negative sentiment spikes
- Competitor actions

**Output**: `NewsSentiment` with news events and alerts

### 8. RiskAssessmentAgent (`risk.ts`)

**Purpose**: Comprehensive risk identification and quantification

**Risk Categories**:
- Execution risk (management capability, operational complexity)
- Market risk (demand uncertainty, competitive threats)
- Technology risk (technical debt, security vulnerabilities)
- Financial risk (liquidity, customer concentration)
- Regulatory risk (compliance gaps, pending regulations)
- Integration risk (cultural fit, synergy realization)

**Risk Scoring Framework**:
```typescript
score = probability × impact × (1 - mitigation)
```

**Output**: `RiskAssessment` with risk scoring and mitigation strategies

### 9. SynthesisReportingAgent (`synthesis.ts`)

**Purpose**: Generate actionable deliverables from research

**Output Formats**:

1. **Investment Memo** - Comprehensive 10-15 page report
   - Executive summary with recommendation
   - Investment thesis and key drivers
   - Financial analysis and valuation
   - Risk assessment and mitigation
   - 100-day plan post-acquisition

2. **Red Flag Report** - 2-3 page critical issues summary
   - Critical issues requiring immediate attention
   - High-risk areas for deep dive
   - Go/no-go recommendation

3. **Interactive Dashboard** - Real-time metrics and visualizations
   - Key metrics and trends
   - Charts and graphs
   - Real-time monitoring alerts

## Base Agent Features

All agents inherit from `BaseAgent` which provides:

### Error Handling
- Automatic retry with exponential backoff
- Timeout protection
- Graceful degradation
- Detailed error logging

### Metrics Tracking
- Execution time measurement
- Data point counting
- Source tracking
- Confidence calculation

### Result Format
```typescript
interface AgentResult {
  agentId: string;
  agentType: string;
  status: 'success' | 'partial' | 'failed';
  data: any;
  metadata: {
    executionTime: number;
    dataPoints: number;
    sources: string[];
    confidence: number;
  };
  warnings: string[];
  errors: string[];
  timestamp: Date;
}
```

## Usage Example

```typescript
import {
  OrchestratorAgent,
  FinancialAnalysisAgent,
  MarketIndustryAgent,
} from './agents';

// Create orchestrator
const orchestrator = new OrchestratorAgent();

// Plan research
const plan = await orchestrator.planResearch('Acme Corp', {
  includeFinancial: true,
  includeMarket: true,
  includeCompetitive: true,
  includeTechnology: true,
  includeCustomer: true,
  includeNews: true,
  includeRisk: true,
  depth: 'deep',
});

// Execute financial analysis
const financialAgent = new FinancialAnalysisAgent();
const financialResult = await financialAgent.execute({
  companyName: 'Acme Corp',
  ticker: 'ACME',
  depth: 'deep',
});

console.log(`Financial analysis completed with ${financialResult.metadata.confidence}% confidence`);
console.log(`Found ${financialResult.metadata.dataPoints} data points from ${financialResult.metadata.sources.length} sources`);
```

## Configuration

Each agent can be configured with:

```typescript
interface AgentConfig {
  name: string;           // Agent instance name
  type: string;           // Agent type identifier
  maxRetries?: number;    // Number of retry attempts (default: 3)
  timeout?: number;       // Timeout in milliseconds (default: 300000)
  enableCaching?: boolean; // Enable result caching (default: true)
}
```

## Type Definitions

All TypeScript interfaces and types are defined in `/home/user/diligence-cubed/src/types/agents.ts`, including:

- Input types for each agent
- Output types with comprehensive data structures
- Common types (DiligenceScope, Task, AgentResult, etc.)
- Error types (AgentError, DataSourceError, ValidationError)

## Extension

To add a new agent:

1. Create a new file in this directory
2. Extend `BaseAgent`
3. Implement `executeInternal(input: YourInputType): Promise<YourOutputType>`
4. Optionally override `validateInput()` for custom validation
5. Add to exports in `index.ts`
6. Define input/output types in `/home/user/diligence-cubed/src/types/agents.ts`

Example:
```typescript
import { BaseAgent } from './base';
import { AgentError } from '../types/agents';

export class MyCustomAgent extends BaseAgent {
  constructor() {
    super({
      name: 'my-custom-agent',
      type: 'custom',
    });
  }

  protected validateInput(input: any): void {
    super.validateInput(input);
    // Add custom validation
  }

  protected async executeInternal(input: any): Promise<any> {
    this.log('info', 'Executing custom analysis');

    // Your implementation here
    this.updateMetrics({ dataPoints: 10, sources: ['Custom Source'] });

    return {
      // Your results
    };
  }
}
```

## Testing

Each agent should be tested for:
- Input validation
- Error handling and retries
- Timeout behavior
- Metrics tracking
- Result format consistency
- Business logic correctness

## Performance Considerations

- Agents execute in parallel when possible (managed by Orchestrator)
- Results are cached to avoid redundant API calls
- Timeout protection prevents hung operations
- Retry logic handles transient failures
- Metrics tracking helps identify bottlenecks

## Future Enhancements

- [ ] Implement actual MCP server integrations
- [ ] Add result caching layer (Redis)
- [ ] Implement state persistence for long-running operations
- [ ] Add agent performance monitoring and optimization
- [ ] Implement adaptive depth control based on risk signals
- [ ] Add self-improvement feedback loops
- [ ] Integrate with Claude Agents SDK for orchestration
- [ ] Add webhook notifications for real-time updates
