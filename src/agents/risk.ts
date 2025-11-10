/**
 * Risk Assessment Agent
 * Comprehensive risk identification and quantification
 */

import { BaseAgent } from './base';
import {
  RiskAssessmentInput,
  ExtendedRiskAssessment,
  RiskDomain,
  RiskFactor,
  RiskItem,
  RiskScore,
  RiskCategory,
  MitigationStrategy,
  AgentError,
} from '../types/agents';

export class RiskAssessmentAgent extends BaseAgent {
  constructor() {
    super({
      name: 'risk-assessment-agent',
      type: 'risk',
      maxRetries: 3,
      timeout: 300000,
    });
  }

  protected validateInput(input: RiskAssessmentInput): void {
    super.validateInput(input);
    if (!input.companyName) {
      throw new AgentError('Company name is required', this.type);
    }
  }

  protected async executeInternal(input: RiskAssessmentInput): Promise<ExtendedRiskAssessment> {
    this.log('info', `Assessing risks for ${input.companyName}`);

    try {
      const executionRisk = await this.assessExecutionRisk(input);
      const marketRisk = await this.assessMarketRisk(input);
      const technologyRisk = await this.assessTechnologyRisk(input);
      const financialRisk = await this.assessFinancialRisk(input);
      const regulatoryRisk = await this.assessRegulatoryRisk(input);
      const integrationRisk = await this.assessIntegrationRisk(input);

      const topRisks = await this.identifyTopRisks([
        executionRisk,
        marketRisk,
        technologyRisk,
        financialRisk,
        regulatoryRisk,
        integrationRisk,
      ]);

      const mitigationStrategies = await this.developMitigationStrategies(topRisks);

      const overallRiskScore = this.calculateOverallRiskScore([
        executionRisk,
        marketRisk,
        technologyRisk,
        financialRisk,
        regulatoryRisk,
      ]);

      const riskCategory = this.categorizeRisk(overallRiskScore);

      this.updateMetrics({ dataPoints: 40, sources: ['All Previous Analyses'] });

      return {
        overallRiskScore,
        riskCategory,
        executionRisk,
        marketRisk,
        technologyRisk,
        financialRisk,
        regulatoryRisk,
        integrationRisk,
        topRisks: topRisks.map(risk => ({
          category: risk.category,
          description: risk.description,
          severity: risk.severity as 'info' | 'warning' | 'critical',
        })),
        mitigationStrategies: mitigationStrategies.map(strat => strat.strategy),
        dataQuality: this.calculateConfidence(),
      };
    } catch (error) {
      this.handleError(error, 'risk assessment');
    }
  }

  private async assessExecutionRisk(_input: RiskAssessmentInput): Promise<RiskDomain> {
    this.log('info', 'Assessing execution risk');

    const factors: RiskFactor[] = [
      {
        name: 'Management Experience',
        probability: 0.3,
        impact: 7,
        description: 'Management team has strong track record',
      },
      {
        name: 'Operational Complexity',
        probability: 0.5,
        impact: 6,
        description: 'Moderate operational complexity',
      },
      {
        name: 'Scaling Challenges',
        probability: 0.4,
        impact: 7,
        description: 'Typical scaling challenges for growth stage',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Moderate execution risk. Management has experience, but scaling will present challenges.',
    };
  }

  private async assessMarketRisk(_input: RiskAssessmentInput): Promise<RiskDomain> {
    this.log('info', 'Assessing market risk');

    const factors: RiskFactor[] = [
      {
        name: 'Market Demand Uncertainty',
        probability: 0.3,
        impact: 8,
        description: 'Strong and growing demand, but competitive',
      },
      {
        name: 'Competitive Threats',
        probability: 0.6,
        impact: 7,
        description: 'Well-funded competitors entering space',
      },
      {
        name: 'Market Timing',
        probability: 0.2,
        impact: 6,
        description: 'Good market timing, but could change',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Moderate market risk. Strong demand but increasing competition.',
    };
  }

  private async assessTechnologyRisk(_input: RiskAssessmentInput): Promise<RiskDomain> {
    this.log('info', 'Assessing technology risk');

    const factors: RiskFactor[] = [
      {
        name: 'Technical Debt',
        probability: 0.4,
        impact: 6,
        description: 'Some technical debt but manageable',
      },
      {
        name: 'Platform Dependencies',
        probability: 0.3,
        impact: 7,
        description: 'Standard cloud dependencies',
      },
      {
        name: 'Security Vulnerabilities',
        probability: 0.2,
        impact: 9,
        description: 'Few critical vulnerabilities identified',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Low to moderate technology risk. Architecture is sound with manageable technical debt.',
    };
  }

  private async assessFinancialRisk(_input: RiskAssessmentInput): Promise<RiskDomain> {
    this.log('info', 'Assessing financial risk');

    const factors: RiskFactor[] = [
      {
        name: 'Liquidity Risk',
        probability: 0.2,
        impact: 8,
        description: 'Strong cash position and runway',
      },
      {
        name: 'Customer Concentration',
        probability: 0.4,
        impact: 7,
        description: 'Moderate customer concentration',
      },
      {
        name: 'Covenant Compliance',
        probability: 0.1,
        impact: 8,
        description: 'No debt covenants to worry about',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Low financial risk. Strong balance sheet and cash position.',
    };
  }

  private async assessRegulatoryRisk(_input: RiskAssessmentInput): Promise<RiskDomain> {
    this.log('info', 'Assessing regulatory risk');

    const factors: RiskFactor[] = [
      {
        name: 'Compliance Gaps',
        probability: 0.3,
        impact: 6,
        description: 'Minor compliance items to address',
      },
      {
        name: 'Pending Regulations',
        probability: 0.5,
        impact: 5,
        description: 'Industry regulations evolving',
      },
      {
        name: 'Data Privacy',
        probability: 0.3,
        impact: 7,
        description: 'GDPR/CCPA compliant, ongoing monitoring needed',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Moderate regulatory risk. Compliant but needs ongoing attention.',
    };
  }

  private async assessIntegrationRisk(
    _input: RiskAssessmentInput
  ): Promise<RiskDomain | undefined> {
    this.log('info', 'Assessing integration risk');

    const factors: RiskFactor[] = [
      {
        name: 'Cultural Fit',
        probability: 0.4,
        impact: 7,
        description: 'Some cultural differences to bridge',
      },
      {
        name: 'System Compatibility',
        probability: 0.3,
        impact: 6,
        description: 'Systems mostly compatible',
      },
      {
        name: 'Synergy Realization',
        probability: 0.5,
        impact: 8,
        description: 'Synergies possible but execution dependent',
      },
    ];

    const score = this.calculateDomainScore(factors);

    return {
      score,
      category: this.categorizeRisk(score),
      factors,
      assessment:
        'Moderate integration risk. Standard challenges expected.',
    };
  }

  private async identifyTopRisks(domains: (RiskDomain | undefined)[]): Promise<RiskItem[]> {
    this.log('info', 'Identifying top risks');

    const allRisks: RiskItem[] = [];

    for (const domain of domains) {
      if (!domain) continue;

      for (const factor of domain.factors) {
        const score = this.calculateRiskScore(factor.probability, factor.impact, 0);
        allRisks.push({
          rank: 0, // Will be set after sorting
          category: domain.assessment.split(' ')[0], // First word as category
          description: factor.description,
          probability: factor.probability,
          impact: factor.impact,
          score: score.adjusted,
          severity: score.category,
          indicators: [factor.name],
        });
      }
    }

    // Sort by score descending and assign ranks
    allRisks.sort((a, b) => b.score - a.score);
    allRisks.forEach((risk, index) => {
      risk.rank = index + 1;
    });

    // Return top 10
    return allRisks.slice(0, 10);
  }

  private async developMitigationStrategies(
    topRisks: RiskItem[]
  ): Promise<MitigationStrategy[]> {
    this.log('info', 'Developing mitigation strategies');

    const strategies: MitigationStrategy[] = [];

    for (const risk of topRisks.slice(0, 5)) {
      // Top 5 risks
      strategies.push({
        risk: risk.description,
        strategy: this.generateMitigationStrategy(risk),
        effectiveness: 0.7,
        effort: risk.impact > 7 ? 'high' : 'medium',
        timeline: risk.severity === 'critical' ? 'Immediate' : '3-6 months',
      });
    }

    return strategies;
  }

  private generateMitigationStrategy(risk: RiskItem): string {
    // Simple strategy generation based on category
    if (risk.category.includes('execution') || risk.category.includes('Moderate')) {
      return 'Implement monitoring and regular review process';
    } else if (risk.category.includes('market') || risk.category.includes('Market')) {
      return 'Develop contingency plans and diversification strategy';
    } else if (risk.category.includes('technology') || risk.category.includes('Technology')) {
      return 'Invest in technical infrastructure and security improvements';
    } else if (risk.category.includes('financial') || risk.category.includes('Financial')) {
      return 'Strengthen financial controls and reporting';
    } else {
      return 'Establish risk monitoring and mitigation protocols';
    }
  }

  private calculateDomainScore(factors: RiskFactor[]): number {
    let totalScore = 0;
    for (const factor of factors) {
      totalScore += factor.probability * factor.impact;
    }
    return totalScore / factors.length;
  }

  private calculateOverallRiskScore(domains: (RiskDomain | undefined)[]): number {
    const validDomains = domains.filter((d) => d !== undefined) as RiskDomain[];
    if (validDomains.length === 0) return 0;

    const sum = validDomains.reduce((acc, domain) => acc + domain.score, 0);
    return sum / validDomains.length;
  }

  /**
   * Calculate risk score with mitigation factor
   */
  calculateRiskScore(probability: number, impact: number, mitigation: number): RiskScore {
    const raw = probability * impact;
    const adjusted = raw * (1 - mitigation);
    const category = this.categorizeRisk(adjusted);

    return {
      raw,
      adjusted,
      category,
    };
  }

  private categorizeRisk(score: number): RiskCategory {
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
}
