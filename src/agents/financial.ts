/**
 * Financial Analysis Agent
 * Comprehensive financial analysis and modeling
 */

import { BaseAgent } from './base';
import {
  FinancialAnalysisInput,
  FinancialSummary,
  RevenueMetrics,
  ProfitabilityMetrics,
  CashFlowMetrics,
  BalanceSheetMetrics,
  ValuationAnalysis,
  UnitEconomics,
  ScenarioAnalysis,
  AgentError,
} from '../types/agents';

export class FinancialAnalysisAgent extends BaseAgent {
  constructor() {
    super({
      name: 'financial-analysis-agent',
      type: 'financial',
      maxRetries: 3,
      timeout: 300000, // 5 minutes
    });
  }

  protected validateInput(input: FinancialAnalysisInput): void {
    super.validateInput(input);
    if (!input.companyName) {
      throw new AgentError('Company name is required', this.type);
    }
  }

  protected async executeInternal(input: FinancialAnalysisInput): Promise<FinancialSummary> {
    this.log('info', `Analyzing financials for ${input.companyName}`);

    try {
      // In a real implementation, this would fetch data from AlphaVantage, SEC EDGAR, etc.
      const revenueMetrics = await this.analyzeRevenue(input);
      const profitability = await this.analyzeProfitability(input);
      const cashFlow = await this.analyzeCashFlow(input);
      const balanceSheet = await this.analyzeBalanceSheet(input);
      const valuation = await this.performValuation(input);
      const unitEconomics = await this.analyzeUnitEconomics(input);
      const scenarios = await this.performScenarioAnalysis(input);

      const redFlags = this.identifyRedFlags({
        revenueMetrics,
        profitability,
        cashFlow,
        balanceSheet,
      });

      const opportunities = this.identifyOpportunities({
        revenueMetrics,
        profitability,
        valuation,
      });

      this.updateMetrics({ dataPoints: 50, sources: ['AlphaVantage', 'SEC EDGAR'] });

      return {
        revenueMetrics,
        profitability,
        cashFlow,
        balanceSheet,
        valuation,
        unitEconomics,
        scenarios,
        redFlags,
        opportunities,
        dataQuality: this.calculateConfidence(),
      };
    } catch (error) {
      this.handleError(error, 'financial analysis');
    }
  }

  private async analyzeRevenue(_input: FinancialAnalysisInput): Promise<RevenueMetrics> {
    this.log('info', 'Analyzing revenue metrics');

    // Placeholder implementation - would fetch real data from MCP servers
    return {
      currentRevenue: 100000000,
      arr: 95000000,
      growthRate: 35.5,
      growthRateYoY: [25.0, 30.0, 35.5],
      revenueQuality: 85,
      recurring: 95,
      oneTime: 5,
    };
  }

  private async analyzeProfitability(
    _input: FinancialAnalysisInput
  ): Promise<ProfitabilityMetrics> {
    this.log('info', 'Analyzing profitability');

    return {
      grossMargin: 75.5,
      ebitdaMargin: 15.2,
      netMargin: 8.5,
      marginTrends: [73.0, 74.5, 75.5],
    };
  }

  private async analyzeCashFlow(_input: FinancialAnalysisInput): Promise<CashFlowMetrics> {
    this.log('info', 'Analyzing cash flow');

    return {
      operatingCashFlow: 20000000,
      freeCashFlow: 15000000,
      fcfConversion: 75.0,
      burnRate: 0,
      runway: undefined,
    };
  }

  private async analyzeBalanceSheet(
    _input: FinancialAnalysisInput
  ): Promise<BalanceSheetMetrics> {
    this.log('info', 'Analyzing balance sheet');

    return {
      totalAssets: 150000000,
      totalLiabilities: 50000000,
      equity: 100000000,
      debt: 20000000,
      cash: 40000000,
      currentRatio: 2.5,
      quickRatio: 2.0,
      debtToEquity: 0.2,
    };
  }

  private async performValuation(_input: FinancialAnalysisInput): Promise<ValuationAnalysis> {
    this.log('info', 'Performing valuation analysis');

    return {
      enterpriseValue: 800000000,
      evRevenue: 8.0,
      evEbitda: 52.6,
      dcfValuation: 750000000,
      comparablesRange: {
        min: 600000000,
        max: 900000000,
        median: 750000000,
      },
      impliedValuation: 775000000,
    };
  }

  private async analyzeUnitEconomics(
    _input: FinancialAnalysisInput
  ): Promise<UnitEconomics | undefined> {
    this.log('info', 'Analyzing unit economics');

    // Only applicable for certain business models
    return {
      cac: 5000,
      ltv: 25000,
      ltvCacRatio: 5.0,
      paybackPeriod: 12,
      contributionMargin: 65.0,
    };
  }

  private async performScenarioAnalysis(
    _input: FinancialAnalysisInput
  ): Promise<ScenarioAnalysis> {
    this.log('info', 'Performing scenario analysis');

    return {
      base: {
        name: 'Base Case',
        probability: 0.6,
        revenue: 135000000,
        ebitda: 20520000,
        valuation: 775000000,
        assumptions: [
          'Maintain current growth rate',
          'Stable margins',
          'No major market disruptions',
        ],
      },
      bull: {
        name: 'Bull Case',
        probability: 0.2,
        revenue: 160000000,
        ebitda: 28800000,
        valuation: 1000000000,
        assumptions: [
          'Accelerated growth from new products',
          'Market expansion',
          'Margin improvement',
        ],
      },
      bear: {
        name: 'Bear Case',
        probability: 0.2,
        revenue: 110000000,
        ebitda: 13200000,
        valuation: 550000000,
        assumptions: [
          'Increased competition',
          'Slower growth',
          'Margin compression',
        ],
      },
    };
  }

  private identifyRedFlags(data: any): string[] {
    const redFlags: string[] = [];

    if (data.cashFlow.burnRate && data.cashFlow.runway < 12) {
      redFlags.push('Low runway - less than 12 months of cash remaining');
    }

    if (data.profitability.grossMargin < 40) {
      redFlags.push('Low gross margin indicates pricing or cost structure issues');
    }

    if (data.revenueMetrics.growthRate < 10) {
      redFlags.push('Low revenue growth rate');
    }

    if (data.balanceSheet.debtToEquity > 2.0) {
      redFlags.push('High debt-to-equity ratio indicates financial risk');
    }

    if (data.balanceSheet.currentRatio < 1.0) {
      redFlags.push('Current ratio below 1.0 indicates liquidity concerns');
    }

    return redFlags;
  }

  private identifyOpportunities(data: any): string[] {
    const opportunities: string[] = [];

    if (data.revenueMetrics.growthRate > 50) {
      opportunities.push('High growth rate indicates strong market demand');
    }

    if (data.profitability.grossMargin > 70) {
      opportunities.push('Strong gross margins provide pricing power and flexibility');
    }

    if (data.valuation.dcfValuation > data.valuation.enterpriseValue) {
      opportunities.push('Company appears undervalued based on DCF analysis');
    }

    return opportunities;
  }
}
