# Usage Examples

Comprehensive examples for using Diligence Cubed in various scenarios.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Diligence Workflows](#diligence-workflows)
- [Custom Agent Configuration](#custom-agent-configuration)
- [Webhook Integration](#webhook-integration)
- [API Integration](#api-integration)
- [Advanced Scenarios](#advanced-scenarios)
- [Error Handling](#error-handling)

## Basic Usage

### Simple Diligence Analysis

```typescript
import { DiligenceClient } from 'diligence-cubed';

async function basicExample() {
  // Initialize client
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY
    }
  });

  // Start diligence
  const diligence = await client.startDiligence({
    companyName: 'Acme Corporation',
    companyDomain: 'acme.com',
    type: 'full',
    depth: 'standard'
  });

  console.log(`Diligence started: ${diligence.id}`);
  console.log(`Estimated completion: ${diligence.estimatedCompletion}`);

  // Wait for completion (poll status)
  let status;
  do {
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
    status = await client.getStatus(diligence.id);
    console.log(`Progress: ${status.progress}%`);
  } while (status.status === 'in_progress');

  // Get results
  if (status.status === 'completed') {
    const report = await client.getReport(diligence.id);
    console.log('Analysis complete!');
    console.log('Executive Summary:', report.executiveSummary);
  }
}

basicExample().catch(console.error);
```

### Quick Financial Analysis

```typescript
async function financialAnalysisExample() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY
    }
  });

  // Focus on financial analysis only
  const diligence = await client.startDiligence({
    companyName: 'Tech Startup Inc',
    companyDomain: 'techstartup.com',
    type: 'financial',  // Financial focus
    depth: 'deep',
    focus: ['revenue_quality', 'unit_economics', 'valuation']
  });

  const report = await client.waitForCompletion(diligence.id);

  // Extract financial insights
  const { financialAnalysis } = report;
  console.log('Revenue Growth:', financialAnalysis.revenueMetrics.growthRate);
  console.log('Gross Margin:', financialAnalysis.profitability.grossMargin);
  console.log('Valuation:', financialAnalysis.valuation.dcfValuation);
  console.log('Red Flags:', financialAnalysis.redFlags);
}
```

## Diligence Workflows

### Full Due Diligence

```typescript
async function fullDiligenceWorkflow() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY,
      github: process.env.GITHUB_TOKEN,
      newsapi: process.env.NEWS_API_KEY
    }
  });

  // Comprehensive analysis
  const diligence = await client.startDiligence({
    companyName: 'SaaS Company',
    companyDomain: 'saascompany.com',
    type: 'full',
    depth: 'deep',
    priority: 'high',
    metadata: {
      dealSize: 50000000,
      sector: 'B2B SaaS',
      analystName: 'John Doe'
    }
  });

  // Monitor progress with real-time updates
  const subscription = client.subscribe(diligence.id, (update) => {
    console.log(`[${update.type}] ${update.agent}: ${update.data.message}`);

    if (update.type === 'red_flag') {
      console.warn('RED FLAG DETECTED:', update.data);
      // Alert team
      notifyTeam(update.data);
    }
  });

  // Wait for completion
  const report = await client.waitForCompletion(diligence.id);

  subscription.unsubscribe();

  // Generate outputs
  await Promise.all([
    client.exportReport(diligence.id, 'pdf', './investment-memo.pdf'),
    client.exportReport(diligence.id, 'excel', './financial-model.xlsx'),
    client.exportReport(diligence.id, 'json', './data.json')
  ]);

  console.log('Full diligence completed!');
  return report;
}
```

### Tech Company Analysis

```typescript
async function techCompanyDiligence() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      github: process.env.GITHUB_TOKEN,
      exa: process.env.EXA_API_KEY,
      newsapi: process.env.NEWS_API_KEY
    }
  });

  // Technical due diligence for software company
  const diligence = await client.startDiligence({
    companyName: 'DevTools Inc',
    companyDomain: 'devtools.com',
    type: 'technical',
    depth: 'exhaustive',
    agents: {
      technical: {
        enabled: true,
        focus: 'code_quality',
        includeSecurityAudit: true,
        repositories: [
          'devtools-inc/core-platform',
          'devtools-inc/api-server',
          'devtools-inc/frontend'
        ]
      },
      competitive: {
        enabled: true,
        includePatentAnalysis: true
      },
      customer: {
        enabled: true,
        analyzeGitHubStars: true,
        analyzeDockerPulls: true
      }
    }
  });

  const report = await client.waitForCompletion(diligence.id);

  // Technical insights
  console.log('Architecture Score:', report.productAnalysis.architecture.scalability);
  console.log('Code Quality:', report.productAnalysis.codeQuality);
  console.log('Tech Debt:', report.productAnalysis.architecture.technicalDebt);
  console.log('Engineering Velocity:', report.productAnalysis.engineeringMetrics);

  return report;
}
```

### Competitive Analysis

```typescript
async function competitiveAnalysis() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      exa: process.env.EXA_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY
    }
  });

  // Deep competitive analysis
  const diligence = await client.startDiligence({
    companyName: 'Competitive Analysis: MarketCo',
    companyDomain: 'marketco.com',
    type: 'commercial',
    depth: 'deep',
    agents: {
      competitive: {
        enabled: true,
        depth: 'exhaustive',
        includeIndirectCompetitors: true,
        includeEmergingThreats: true,
        competitorList: [
          'competitor1.com',
          'competitor2.com',
          'competitor3.com'
        ]
      },
      market: {
        enabled: true,
        includeMarketForecasts: true,
        includeRegulatoryAnalysis: true
      }
    }
  });

  const report = await client.waitForCompletion(diligence.id);

  // Competitive insights
  const { competitiveAnalysis } = report;
  console.log('Market Position:', competitiveAnalysis.positioning);
  console.log('Competitors:', competitiveAnalysis.competitors.length);
  console.log('Moat Strength:', competitiveAnalysis.positioning.moatStrength);
  console.log('Disruption Risk:', competitiveAnalysis.disruptionRisk);

  return report;
}
```

## Custom Agent Configuration

### Custom Financial Analysis

```typescript
async function customFinancialAnalysis() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      polygon: process.env.POLYGON_API_KEY
    }
  });

  const diligence = await client.startDiligence({
    companyName: 'FinTech Startup',
    companyDomain: 'fintech.com',
    type: 'financial',
    depth: 'deep',
    agents: {
      financial: {
        enabled: true,
        dataSources: ['alphavantage', 'polygon'],
        valuationMethods: ['dcf', 'comparables', 'precedent_transactions'],
        includeScenarioAnalysis: true,
        scenarios: ['base', 'bull', 'bear'],
        customPrompts: {
          valuation: 'Focus on SaaS metrics: ARR, CAC, LTV, payback period'
        },
        comparableCompanies: [
          'TWLO',  // Twilio
          'NET',   // Cloudflare
          'DDOG'   // Datadog
        ]
      }
    }
  });

  const report = await client.waitForCompletion(diligence.id);
  return report.financialAnalysis;
}
```

### Custom Risk Assessment

```typescript
async function customRiskAssessment() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      exa: process.env.EXA_API_KEY,
      newsapi: process.env.NEWS_API_KEY
    }
  });

  const diligence = await client.startDiligence({
    companyName: 'HealthTech Co',
    companyDomain: 'healthtech.com',
    type: 'full',
    depth: 'exhaustive',
    agents: {
      risk: {
        enabled: true,
        focus: ['regulatory', 'compliance', 'data_privacy'],
        riskCategories: [
          'execution',
          'market',
          'technology',
          'financial',
          'regulatory',
          'integration'
        ],
        customChecks: [
          'HIPAA compliance',
          'FDA approval status',
          'Data breach history',
          'Cybersecurity posture'
        ]
      },
      news: {
        enabled: true,
        monitorKeywords: [
          'lawsuit',
          'investigation',
          'breach',
          'violation',
          'fine'
        ],
        sentimentAnalysis: true
      }
    }
  });

  const report = await client.waitForCompletion(diligence.id);
  return report.riskAssessment;
}
```

## Webhook Integration

### Basic Webhook Setup

```typescript
import express from 'express';
import { DiligenceClient } from 'diligence-cubed';

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhooks/diligence', (req, res) => {
  const { diligenceId, event, data } = req.body;

  console.log(`Webhook received: ${event} for ${diligenceId}`);

  switch (event) {
    case 'diligence.started':
      console.log('Diligence started:', data);
      break;

    case 'diligence.progress':
      console.log(`Progress: ${data.progress}%`);
      break;

    case 'diligence.red_flag':
      console.warn('RED FLAG:', data.finding);
      // Alert team
      sendSlackNotification(data.finding);
      break;

    case 'diligence.completed':
      console.log('Diligence completed!');
      // Download report
      downloadReport(diligenceId);
      break;

    case 'diligence.failed':
      console.error('Diligence failed:', data.error);
      // Alert on-call engineer
      alertEngineers(data.error);
      break;
  }

  res.status(200).send('OK');
});

// Start diligence with webhook
async function startWithWebhook() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY
    }
  });

  const diligence = await client.startDiligence({
    companyName: 'Target Corp',
    companyDomain: 'target.com',
    type: 'full',
    webhookUrl: 'https://myapp.com/webhooks/diligence',
    webhookEvents: [
      'started',
      'progress',
      'red_flag',
      'milestone',
      'completed',
      'failed'
    ]
  });

  console.log(`Diligence started: ${diligence.id}`);
  return diligence;
}

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
  startWithWebhook();
});
```

### Advanced Webhook Handling

```typescript
import crypto from 'crypto';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhooks/diligence', (req, res) => {
  const signature = req.headers['x-diligence-signature'] as string;
  const payload = JSON.stringify(req.body);

  // Verify signature
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const { diligenceId, event, data, timestamp } = req.body;

  // Process webhook
  processWebhook(diligenceId, event, data);

  res.status(200).send('OK');
});

async function processWebhook(diligenceId: string, event: string, data: any) {
  // Store in database
  await db.webhooks.create({
    diligenceId,
    event,
    data,
    receivedAt: new Date()
  });

  // Process event
  switch (event) {
    case 'diligence.red_flag':
      await handleRedFlag(diligenceId, data);
      break;

    case 'diligence.completed':
      await handleCompletion(diligenceId, data);
      break;
  }
}

async function handleRedFlag(diligenceId: string, data: any) {
  // Send Slack notification
  await sendSlackMessage({
    channel: '#due-diligence',
    text: `🚨 Red flag detected in ${diligenceId}`,
    attachments: [{
      title: data.finding.title,
      text: data.finding.description,
      color: 'danger',
      fields: [
        {
          title: 'Severity',
          value: data.finding.severity,
          short: true
        },
        {
          title: 'Agent',
          value: data.finding.agent,
          short: true
        }
      ]
    }]
  });

  // Create Jira ticket
  await createJiraIssue({
    project: 'DD',
    summary: `Red Flag: ${data.finding.title}`,
    description: data.finding.description,
    priority: data.finding.severity === 'critical' ? 'Highest' : 'High'
  });
}
```

## API Integration

### REST API Usage

```typescript
import axios from 'axios';

class DiligenceAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.diligence-cubed.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async startDiligence(params: DiligenceParams) {
    const response = await axios.post(
      `${this.baseUrl}/diligence`,
      params,
      { headers: this.headers }
    );
    return response.data;
  }

  async getStatus(diligenceId: string) {
    const response = await axios.get(
      `${this.baseUrl}/diligence/${diligenceId}/status`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getResults(diligenceId: string, format: string = 'json') {
    const response = await axios.get(
      `${this.baseUrl}/diligence/${diligenceId}/results`,
      {
        headers: this.headers,
        params: { format }
      }
    );
    return response.data;
  }

  async getFindings(diligenceId: string, filters: FindingsFilter = {}) {
    const response = await axios.get(
      `${this.baseUrl}/diligence/${diligenceId}/findings`,
      {
        headers: this.headers,
        params: filters
      }
    );
    return response.data;
  }
}

// Usage
const api = new DiligenceAPI(process.env.DILIGENCE_API_KEY);

const diligence = await api.startDiligence({
  company_name: 'Acme Corp',
  company_domain: 'acme.com',
  diligence_type: 'full',
  depth: 'standard'
});

console.log('Diligence ID:', diligence.diligence_id);

// Poll for completion
while (true) {
  const status = await api.getStatus(diligence.diligence_id);
  console.log(`Progress: ${status.progress}%`);

  if (status.status === 'completed') {
    const results = await api.getResults(diligence.diligence_id);
    console.log('Results:', results);
    break;
  }

  await new Promise(resolve => setTimeout(resolve, 30000));
}
```

### Batch Processing

```typescript
async function batchDiligence() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY
    }
  });

  const companies = [
    { name: 'Company A', domain: 'companya.com' },
    { name: 'Company B', domain: 'companyb.com' },
    { name: 'Company C', domain: 'companyc.com' },
  ];

  // Start all diligences
  const diligences = await Promise.all(
    companies.map(company =>
      client.startDiligence({
        companyName: company.name,
        companyDomain: company.domain,
        type: 'full',
        depth: 'standard',
        priority: 'normal'
      })
    )
  );

  console.log(`Started ${diligences.length} diligences`);

  // Wait for all to complete
  const results = await Promise.all(
    diligences.map(d => client.waitForCompletion(d.id))
  );

  // Generate comparison report
  const comparison = compareCompanies(results);
  console.log('Comparison:', comparison);

  return results;
}

function compareCompanies(reports: Report[]) {
  return reports.map(report => ({
    company: report.company.name,
    recommendation: report.executiveSummary.recommendation,
    valuation: report.financialAnalysis.valuation.dcfValuation,
    riskScore: report.riskAssessment.overallRiskScore,
    keyStrengths: report.executiveSummary.keyStrengths,
    keyConcerns: report.executiveSummary.keyConcerns
  }));
}
```

## Advanced Scenarios

### Progressive Diligence

```typescript
async function progressiveDiligence() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY,
      newsapi: process.env.NEWS_API_KEY
    }
  });

  // Phase 1: Quick screening
  const screening = await client.startDiligence({
    companyName: 'Target Corp',
    companyDomain: 'target.com',
    type: 'financial',
    depth: 'standard'
  });

  const screeningReport = await client.waitForCompletion(screening.id);

  // Decision point: Should we proceed?
  const redFlags = screeningReport.financialAnalysis.redFlags;
  if (redFlags.filter(f => f.severity === 'critical').length > 0) {
    console.log('Critical red flags found. Stopping diligence.');
    return { recommendation: 'pass', reason: 'critical_red_flags' };
  }

  // Phase 2: Deep dive on interesting areas
  const deepDive = await client.startDiligence({
    companyName: 'Target Corp',
    companyDomain: 'target.com',
    type: 'full',
    depth: 'deep',
    focus: identifyFocusAreas(screeningReport)
  });

  const fullReport = await client.waitForCompletion(deepDive.id);

  return fullReport;
}

function identifyFocusAreas(report: Report): string[] {
  const focusAreas = [];

  // High growth → deep dive on scalability
  if (report.financialAnalysis.revenueMetrics.growthRate > 0.5) {
    focusAreas.push('scalability', 'operational_efficiency');
  }

  // Low margins → investigate cost structure
  if (report.financialAnalysis.profitability.grossMargin < 0.3) {
    focusAreas.push('cost_structure', 'pricing_power');
  }

  // Crowded market → detailed competitive analysis
  if (report.marketAnalysis?.industryStructure?.concentration === 'high') {
    focusAreas.push('competitive_moat', 'differentiation');
  }

  return focusAreas;
}
```

### Custom Report Generation

```typescript
async function customReportGeneration() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY
    }
  });

  const diligence = await client.startDiligence({
    companyName: 'SaaS Startup',
    companyDomain: 'saasstartup.com',
    type: 'full',
    depth: 'deep'
  });

  const report = await client.waitForCompletion(diligence.id);

  // Generate custom Investment Committee memo
  const icMemo = {
    executive_summary: {
      company: report.company.name,
      recommendation: report.executiveSummary.recommendation,
      proposed_investment: '$25M Series B',
      valuation: `$${report.financialAnalysis.valuation.dcfValuation / 1e6}M`,
      key_thesis: report.executiveSummary.investmentThesis
    },
    financial_highlights: {
      arr: report.financialAnalysis.revenueMetrics.currentRevenue,
      growth_rate: report.financialAnalysis.revenueMetrics.growthRate,
      gross_margin: report.financialAnalysis.profitability.grossMargin,
      burn_rate: calculateBurnRate(report),
      runway: calculateRunway(report)
    },
    market_opportunity: {
      tam: report.marketAnalysis.marketSize.tam,
      market_growth: report.marketAnalysis.marketSize.growthRate,
      competitive_position: report.competitiveAnalysis.positioning
    },
    risk_summary: {
      overall_risk: report.riskAssessment.overallRiskScore,
      top_risks: report.riskAssessment.criticalRisks.slice(0, 5),
      mitigation_plans: report.riskAssessment.mitigationRecommendations
    },
    recommendation: {
      decision: report.executiveSummary.recommendation,
      conditions: extractConditions(report),
      timeline: '45 days for completion'
    }
  };

  // Export to PDF
  await generatePDF(icMemo, './ic-memo.pdf');

  return icMemo;
}
```

## Error Handling

### Robust Error Handling

```typescript
import {
  DiligenceClient,
  DiligenceError,
  RateLimitError,
  ValidationError,
  NotFoundError
} from 'diligence-cubed';

async function robustDiligence() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY
    },
    retryOptions: {
      maxRetries: 3,
      backoff: 'exponential',
      initialDelay: 1000
    }
  });

  try {
    const diligence = await client.startDiligence({
      companyName: 'Target Corp',
      companyDomain: 'target.com',
      type: 'full',
      depth: 'standard'
    });

    const report = await client.waitForCompletion(diligence.id, {
      timeout: 7200000,  // 2 hours
      pollInterval: 30000  // 30 seconds
    });

    return report;

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.errors);
      // Handle validation errors
      for (const err of error.errors) {
        console.log(`Field ${err.field}: ${err.message}`);
      }

    } else if (error instanceof RateLimitError) {
      console.error('Rate limit exceeded');
      const retryAfter = error.retryAfter;
      console.log(`Retry after ${retryAfter} seconds`);

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return robustDiligence();  // Retry

    } else if (error instanceof NotFoundError) {
      console.error('Resource not found:', error.message);
      // Handle not found

    } else if (error instanceof DiligenceError) {
      console.error('Diligence error:', error.message);
      console.log('Error code:', error.code);
      console.log('Status code:', error.statusCode);

      // Log for debugging
      await logError(error);

    } else {
      console.error('Unexpected error:', error);
      // Alert engineering team
      await alertEngineers(error);
    }

    throw error;
  }
}
```

### Graceful Degradation

```typescript
async function gracefulDegradation() {
  const client = new DiligenceClient({
    apiKey: process.env.DILIGENCE_API_KEY,
    mcpServers: {
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      exa: process.env.EXA_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY
    }
  });

  try {
    // Try full analysis
    return await client.startDiligence({
      companyName: 'Target Corp',
      companyDomain: 'target.com',
      type: 'full',
      depth: 'deep'
    });

  } catch (error) {
    console.warn('Full analysis failed, trying standard depth');

    try {
      // Fallback to standard depth
      return await client.startDiligence({
        companyName: 'Target Corp',
        companyDomain: 'target.com',
        type: 'full',
        depth: 'standard'
      });

    } catch (error2) {
      console.warn('Standard analysis failed, trying financial only');

      // Final fallback: financial analysis only
      return await client.startDiligence({
        companyName: 'Target Corp',
        companyDomain: 'target.com',
        type: 'financial',
        depth: 'standard'
      });
    }
  }
}
```

## Conclusion

These examples demonstrate the flexibility and power of Diligence Cubed. For more information:

- [API Documentation](API.md)
- [Architecture Guide](ARCHITECTURE.md)
- [MCP Integration](MCP_INTEGRATION.md)

For questions or support, contact support@diligence-cubed.com
