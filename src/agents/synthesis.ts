/**
 * Synthesis & Reporting Agent
 * Generate actionable deliverables from research
 */

import { BaseAgent } from './base';
import {
  SynthesisInput,
  InvestmentMemo,
  InvestmentThesis,
  RedFlagReport,
  CriticalIssue,
  HighRiskArea,
  Dashboard,
  DashboardOverview,
  DashboardMetric,
  DashboardChart,
  Alert,
  AgentError,
} from '../types/agents';
import { ResearchGap } from '../types/diligence';

export class SynthesisReportingAgent extends BaseAgent {
  constructor() {
    super({
      name: 'synthesis-reporting-agent',
      type: 'synthesis',
      maxRetries: 2,
      timeout: 300000,
    });
  }

  protected validateInput(input: SynthesisInput): void {
    super.validateInput(input);
    if (!input.diligenceId) {
      throw new AgentError('Diligence ID is required', this.type);
    }
    if (!input.allResults || input.allResults.size === 0) {
      throw new AgentError('Agent results are required', this.type);
    }
  }

  protected async executeInternal(input: SynthesisInput): Promise<any> {
    this.log('info', `Synthesizing reports for diligence ${input.diligenceId}`);

    try {
      const investmentMemo = await this.generateInvestmentMemo(input);
      const redFlagReport = await this.generateRedFlagReport(input);
      const dashboard = await this.generateDashboard(input);

      this.updateMetrics({
        dataPoints: input.allResults.size,
        sources: ['All Agent Results'],
      });

      return {
        investmentMemo,
        redFlagReport,
        dashboard,
      };
    } catch (error) {
      this.handleError(error, 'synthesis');
    }
  }

  /**
   * Generate comprehensive investment memo
   */
  async generateInvestmentMemo(input: SynthesisInput): Promise<InvestmentMemo> {
    this.log('info', 'Generating investment memo');

    const financial = input.allResults.get('financial')?.data;
    const market = input.allResults.get('market')?.data;
    const competitive = input.allResults.get('competitive')?.data;
    const risk = input.allResults.get('risk')?.data;

    const investmentThesis = this.createInvestmentThesis(input);
    const executiveSummary = this.createExecutiveSummary(input);

    return {
      title: `Investment Memo: ${input.companyOverview.name}`,
      executiveSummary,
      investmentThesis,
      companyOverview: input.companyOverview,
      marketOpportunity: this.synthesizeMarketOpportunity(market),
      businessModel: this.synthesizeBusinessModel(financial),
      financialAnalysis: this.synthesizeFinancialAnalysis(financial),
      competitivePosition: this.synthesizeCompetitivePosition(competitive),
      managementTeam: 'Strong management team with relevant experience',
      riskAssessment: this.synthesizeRiskAssessment(risk),
      valuation: this.synthesizeValuation(financial),
      recommendation: this.generateRecommendation(input),
      day100Plan: this.create100DayPlan(input),
      appendices: [],
      generatedAt: new Date(),
    };
  }

  /**
   * Generate red flag report for critical issues
   */
  async generateRedFlagReport(input: SynthesisInput): Promise<RedFlagReport> {
    this.log('info', 'Generating red flag report');

    const criticalIssues = this.identifyCriticalIssues(input);
    const highRiskAreas = this.identifyHighRiskAreas(input);
    const mediumConcerns = this.identifyMediumConcerns(input);
    const informationGaps = this.identifyInformationGaps(input);

    const recommendation = this.determineGoNoGo(criticalIssues, highRiskAreas);

    return {
      summary: this.createRedFlagSummary(criticalIssues, highRiskAreas),
      criticalIssues,
      highRiskAreas,
      mediumConcerns,
      informationGaps,
      recommendation,
      conditions:
        recommendation === 'conditional'
          ? [
              'Address critical technical vulnerabilities',
              'Obtain customer references',
              'Verify financial projections',
            ]
          : undefined,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate interactive dashboard data
   */
  async generateDashboard(input: SynthesisInput): Promise<Dashboard> {
    this.log('info', 'Generating dashboard');

    const overview = this.createDashboardOverview(input);
    const keyMetrics = this.extractKeyMetrics(input);
    const charts = this.createCharts(input);
    const alerts = this.extractAlerts(input);

    return {
      overview,
      keyMetrics,
      charts,
      alerts,
      lastUpdated: new Date(),
    };
  }

  // Helper methods for investment memo

  private createInvestmentThesis(input: SynthesisInput): InvestmentThesis {
    return {
      overview: `${input.companyOverview.name} presents a compelling investment opportunity in the ${input.companyOverview.industry} sector.`,
      keyDrivers: [
        'Strong revenue growth trajectory',
        'Large addressable market opportunity',
        'Defensible competitive position',
        'Experienced management team',
      ],
      valueCreation: [
        'Accelerate product development',
        'Expand into new markets',
        'Improve operational efficiency',
        'Strategic acquisitions',
      ],
      exitStrategy: 'Strategic acquisition or IPO within 5-7 years',
      targetReturn: 3.5,
      timeline: '5-7 years',
    };
  }

  private createExecutiveSummary(input: SynthesisInput): any {
    const successCount = Array.from(input.allResults.values()).filter(
      (r) => r.status === 'success'
    ).length;
    const overallScore = (successCount / input.allResults.size) * 100;

    return {
      recommendation: overallScore > 75 ? 'buy' : overallScore > 50 ? 'hold' : 'pass',
      keyFindings: this.extractKeyFindings(input),
      redFlags: this.extractRedFlags(input),
      opportunities: this.extractOpportunities(input),
      overallScore,
    };
  }

  private synthesizeMarketOpportunity(marketData: any): string {
    if (!marketData) return 'Market data not available';

    return `
Large and growing market opportunity with TAM of $${(marketData.marketSizing?.tam / 1e9).toFixed(1)}B
growing at ${marketData.marketSizing?.growthRate}% annually. The company targets a SAM of
$${(marketData.marketSizing?.sam / 1e9).toFixed(1)}B with clear path to capture market share.

Key growth drivers include: ${marketData.growthDrivers?.map((d: any) => d.name).join(', ')}.
    `.trim();
  }

  private synthesizeBusinessModel(financialData: any): string {
    if (!financialData) return 'Financial data not available';

    return `
Recurring revenue business model with ${financialData.revenueMetrics?.recurring}% of revenue from
subscriptions. Strong unit economics with LTV/CAC ratio of ${financialData.unitEconomics?.ltvCacRatio}x
and healthy gross margins of ${financialData.profitability?.grossMargin}%.
    `.trim();
  }

  private synthesizeFinancialAnalysis(financialData: any): string {
    if (!financialData) return 'Financial data not available';

    return `
Current revenue of $${(financialData.revenueMetrics?.currentRevenue / 1e6).toFixed(1)}M growing at
${financialData.revenueMetrics?.growthRate}% YoY. Gross margin of ${financialData.profitability?.grossMargin}%
with path to EBITDA profitability. Strong cash position with ${financialData.cashFlow?.fcfConversion}%
free cash flow conversion.
    `.trim();
  }

  private synthesizeCompetitivePosition(competitiveData: any): string {
    if (!competitiveData) return 'Competitive data not available';

    return `
Defensible competitive position with ${competitiveData.moatAssessment?.overallStrength}/10 moat strength.
Key differentiators include: ${competitiveData.positioning?.differentiators.join(', ')}.
Current market share of ${competitiveData.marketShare?.currentShare}% with strong growth trajectory.
    `.trim();
  }

  private synthesizeRiskAssessment(riskData: any): string {
    if (!riskData) return 'Risk data not available';

    return `
Overall risk score of ${riskData.overallRiskScore?.toFixed(1)}/10 (${riskData.riskCategory} risk).
Primary risk areas include execution risk (${riskData.executionRisk?.score?.toFixed(1)}/10),
market risk (${riskData.marketRisk?.score?.toFixed(1)}/10), and technology risk
(${riskData.technologyRisk?.score?.toFixed(1)}/10). Mitigation strategies identified for top risks.
    `.trim();
  }

  private synthesizeValuation(financialData: any): string {
    if (!financialData) return 'Valuation data not available';

    return `
Current valuation of $${(financialData.valuation?.enterpriseValue / 1e6).toFixed(1)}M implies
${financialData.valuation?.evRevenue}x revenue multiple. DCF analysis suggests fair value of
$${(financialData.valuation?.dcfValuation / 1e6).toFixed(1)}M. Comparable companies trade at
${financialData.valuation?.comparablesRange.median / 1e6}M median valuation.
    `.trim();
  }

  private generateRecommendation(input: SynthesisInput): string {
    const redFlags = this.extractRedFlags(input);
    if (redFlags.length > 5) {
      return 'PASS - Significant red flags identified that outweigh positive factors.';
    }
    return 'PROCEED - Attractive opportunity with manageable risks.';
  }

  private create100DayPlan(_input: SynthesisInput): string {
    return `
1. Complete remaining due diligence items
2. Finalize transaction structure and terms
3. Develop integration roadmap
4. Build relationships with management team
5. Identify quick wins and early value creation opportunities
    `.trim();
  }

  // Helper methods for red flag report

  private identifyCriticalIssues(input: SynthesisInput): CriticalIssue[] {
    const issues: CriticalIssue[] = [];

    for (const [agentType, result] of input.allResults.entries()) {
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          if (error.toLowerCase().includes('critical')) {
            issues.push({
              title: `Critical issue from ${agentType}`,
              description: error,
              severity: 'critical',
              evidence: [agentType],
              immediateAction: 'Requires immediate investigation',
              dealBreaker: true,
            });
          }
        }
      }
    }

    return issues;
  }

  private identifyHighRiskAreas(input: SynthesisInput): HighRiskArea[] {
    const areas: HighRiskArea[] = [];

    const risk = input.allResults.get('risk')?.data;
    if (risk?.topRisks) {
      for (const topRisk of risk.topRisks.slice(0, 3)) {
        if (topRisk.severity === 'high' || topRisk.severity === 'critical') {
          areas.push({
            area: topRisk.category,
            concerns: [topRisk.description],
            deepDiveNeeded: true,
            suggestedActions: ['Conduct detailed analysis', 'Engage subject matter experts'],
          });
        }
      }
    }

    return areas;
  }

  private identifyMediumConcerns(input: SynthesisInput): string[] {
    const concerns: string[] = [];

    for (const [_agentType, result] of input.allResults.entries()) {
      concerns.push(...result.warnings);
    }

    return concerns;
  }

  private identifyInformationGaps(input: SynthesisInput): ResearchGap[] {
    const gaps: ResearchGap[] = [];

    for (const [agentType, result] of input.allResults.entries()) {
      if (result.metadata.confidence < 70) {
        gaps.push({
          area: agentType,
          description: `Low confidence (${result.metadata.confidence}%) in ${agentType} analysis`,
          severity: 'high',
          recommendedAction: 'Additional data sources, Primary research',
        });
      }
    }

    return gaps;
  }

  private determineGoNoGo(
    criticalIssues: CriticalIssue[],
    highRiskAreas: HighRiskArea[]
  ): 'go' | 'no-go' | 'conditional' {
    const dealBreakers = criticalIssues.filter((i) => i.dealBreaker);

    if (dealBreakers.length > 0) {
      return 'no-go';
    } else if (criticalIssues.length > 0 || highRiskAreas.length > 2) {
      return 'conditional';
    } else {
      return 'go';
    }
  }

  private createRedFlagSummary(
    criticalIssues: CriticalIssue[],
    highRiskAreas: HighRiskArea[]
  ): string {
    return `
Identified ${criticalIssues.length} critical issues and ${highRiskAreas.length} high-risk areas
requiring attention before proceeding with transaction.
    `.trim();
  }

  // Helper methods for dashboard

  private createDashboardOverview(input: SynthesisInput): DashboardOverview {
    const keyHighlights = this.extractKeyFindings(input).slice(0, 5);
    const topRisks = this.extractRedFlags(input).slice(0, 3);

    return {
      companyName: input.companyOverview.name,
      overallScore: 75,
      recommendation: 'Buy',
      keyHighlights,
      topRisks,
    };
  }

  private extractKeyMetrics(input: SynthesisInput): DashboardMetric[] {
    const metrics: DashboardMetric[] = [];

    const financial = input.allResults.get('financial')?.data;
    if (financial) {
      metrics.push(
        {
          name: 'Revenue',
          value: financial.revenueMetrics?.currentRevenue || 0,
          unit: 'USD',
          trend: 'up',
          change: financial.revenueMetrics?.growthRate || 0,
          category: 'Financial',
        },
        {
          name: 'Growth Rate',
          value: financial.revenueMetrics?.growthRate || 0,
          unit: '%',
          trend: 'up',
          category: 'Financial',
        },
        {
          name: 'Gross Margin',
          value: financial.profitability?.grossMargin || 0,
          unit: '%',
          trend: 'stable',
          category: 'Financial',
        }
      );
    }

    return metrics;
  }

  private createCharts(input: SynthesisInput): DashboardChart[] {
    const charts: DashboardChart[] = [];

    const financial = input.allResults.get('financial')?.data;
    if (financial?.revenueMetrics?.growthRateYoY) {
      charts.push({
        type: 'line',
        title: 'Revenue Growth Trend',
        data: financial.revenueMetrics.growthRateYoY.map((rate: number, index: number) => ({
          year: 2023 + index,
          growth: rate,
        })),
      });
    }

    return charts;
  }

  private extractAlerts(input: SynthesisInput): Alert[] {
    const alerts: Alert[] = [];

    const news = input.allResults.get('news')?.data;
    if (news?.alerts) {
      alerts.push(...news.alerts);
    }

    return alerts;
  }

  private extractKeyFindings(input: SynthesisInput): string[] {
    const findings: string[] = [];

    for (const [agentType, result] of input.allResults.entries()) {
      if (result.status === 'success') {
        findings.push(`${agentType} analysis completed with ${result.metadata.confidence}% confidence`);
      }
    }

    return findings;
  }

  private extractRedFlags(input: SynthesisInput): string[] {
    const redFlags: string[] = [];

    for (const [_agentType, result] of input.allResults.entries()) {
      redFlags.push(...result.warnings);
      redFlags.push(...result.errors);
    }

    return redFlags;
  }

  private extractOpportunities(input: SynthesisInput): string[] {
    const opportunities: string[] = [];

    const financial = input.allResults.get('financial')?.data;
    if (financial?.opportunities) {
      opportunities.push(...financial.opportunities);
    }

    return opportunities;
  }
}
