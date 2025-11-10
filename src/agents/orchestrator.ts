/**
 * Orchestrator Agent
 * Master coordinator responsible for workflow management and synthesis
 */

import { BaseAgent } from './base';
import {
  Priority,
  AgentError,
  DetailedDiligenceScope,
  DetailedResearchPlan,
  Task,
  CrossValidation,
  Inconsistency,
  DetailedValidationReport,
  AgentExecutionResult,
} from '../types/agents';
import {
  ResearchGap,
  FinalReport,
  CompanyOverview,
  ExecutiveSummary,
} from '../types/diligence';

export interface OrchestratorInput {
  company: string;
  scope: DetailedDiligenceScope;
}

export class OrchestratorAgent extends BaseAgent {
  constructor() {
    super({
      name: 'orchestrator-agent',
      type: 'orchestrator',
      maxRetries: 2,
      timeout: 600000, // 10 minutes
    });
  }

  protected validateInput(input: OrchestratorInput): void {
    super.validateInput(input);
    if (!input.company) {
      throw new AgentError('Company name is required', this.type);
    }
    if (!input.scope) {
      throw new AgentError('Diligence scope is required', this.type);
    }
  }

  protected async executeInternal(input: OrchestratorInput): Promise<any> {
    this.log('info', `Starting orchestration for ${input.company}`);

    // This is a placeholder - actual implementation would coordinate other agents
    return {
      message: 'Orchestrator agent executed',
      company: input.company,
      scope: input.scope,
    };
  }

  /**
   * Create a research plan based on company and scope
   */
  async planResearch(company: string, scope: DetailedDiligenceScope): Promise<DetailedResearchPlan> {
    this.log('info', `Planning research for ${company}`);

    const tasks: Task[] = [];
    const dependencies = new Map<string, string[]>();

    // Create tasks based on scope
    if (scope.includeFinancial) {
      tasks.push(this.createTask('financial-analysis', 'Financial Analysis', 'high', []));
    }

    if (scope.includeMarket) {
      tasks.push(this.createTask('market-analysis', 'Market & Industry Analysis', 'high', []));
    }

    if (scope.includeCompetitive) {
      tasks.push(
        this.createTask('competitive-analysis', 'Competitive Intelligence', 'medium', [
          'market-analysis',
        ])
      );
      dependencies.set('competitive-analysis', ['market-analysis']);
    }

    if (scope.includeTechnology) {
      tasks.push(this.createTask('technology-analysis', 'Technology Assessment', 'medium', []));
    }

    if (scope.includeCustomer) {
      tasks.push(
        this.createTask('customer-analysis', 'Customer & Revenue Analysis', 'high', [
          'financial-analysis',
        ])
      );
      dependencies.set('customer-analysis', ['financial-analysis']);
    }

    if (scope.includeNews) {
      tasks.push(this.createTask('news-sentiment', 'News & Sentiment Analysis', 'low', []));
    }

    if (scope.includeRisk) {
      // Risk assessment depends on all other analyses
      const allTaskIds = tasks.map((t) => t.id);
      tasks.push(this.createTask('risk-assessment', 'Risk Assessment', 'critical', allTaskIds));
      dependencies.set('risk-assessment', allTaskIds);
    }

    // Always add synthesis as final task
    const allTaskIds = tasks.map((t) => t.id);
    tasks.push(this.createTask('synthesis', 'Synthesis & Reporting', 'critical', allTaskIds));
    dependencies.set('synthesis', allTaskIds);

    const estimatedDuration = this.estimateDuration(tasks, scope.depth);

    return {
      id: `plan-${Date.now()}`,
      company,
      scope,
      tasks,
      dependencies,
      estimatedDuration,
      createdAt: new Date(),
    };
  }

  /**
   * Delegate tasks to specialized agents
   */
  async delegateTasks(plan: DetailedResearchPlan): Promise<Task[]> {
    this.log('info', `Delegating ${plan.tasks.length} tasks`);

    // In a real implementation, this would dispatch tasks to agent workers
    // For now, return the tasks with updated status
    return plan.tasks.map((task) => ({
      ...task,
      status: 'pending',
    }));
  }

  /**
   * Validate findings from multiple agents through cross-referencing
   */
  async validateFindings(results: AgentExecutionResult[]): Promise<DetailedValidationReport> {
    this.log('info', `Validating findings from ${results.length} agents`);

    const crossValidatedFacts: CrossValidation[] = [];
    const inconsistencies: Inconsistency[] = [];
    let totalDataPoints = 0;
    let verifiedDataPoints = 0;

    // Analyze results for cross-validation opportunities
    for (const result of results) {
      totalDataPoints += result.metadata.dataPoints;

      if (result.status === 'success') {
        verifiedDataPoints += result.metadata.dataPoints;

        // Create cross-validation records for key facts
        if (result.metadata.sources.length >= 2) {
          crossValidatedFacts.push({
            fact: `Data from ${result.agentType}`,
            sources: result.metadata.sources,
            agreement: result.metadata.confidence / 100,
            confidence: result.metadata.confidence,
          });
        }
      }

      // Check for inconsistencies
      if (result.warnings.length > 0) {
        inconsistencies.push({
          description: `Warnings from ${result.agentType}`,
          conflictingSources: result.metadata.sources,
          severity: 'warning',
          needsResolution: true,
        });
      }
    }

    const overallConfidence =
      totalDataPoints > 0 ? (verifiedDataPoints / totalDataPoints) * 100 : 0;

    return {
      overallConfidence,
      crossValidatedFacts,
      inconsistencies,
      verifiedDataPoints,
      totalDataPoints,
      timestamp: new Date(),
    };
  }

  /**
   * Identify gaps in research that need additional investigation
   */
  async identifyGaps(validated: DetailedValidationReport): Promise<ResearchGap[]> {
    this.log('info', 'Identifying research gaps');

    const gaps: ResearchGap[] = [];

    // Low confidence areas need more research
    if (validated.overallConfidence < 70) {
      gaps.push({
        area: 'Overall Data Quality',
        description: 'Overall confidence is below threshold, additional data sources needed',
        severity: 'high',
        recommendedAction: 'Additional MCP servers, Manual research, Primary sources',
      });
    }

    // Inconsistencies need resolution
    for (const inconsistency of validated.inconsistencies) {
      if (inconsistency.needsResolution && inconsistency.severity === 'critical') {
        gaps.push({
          area: 'Data Inconsistency',
          description: inconsistency.description,
          severity: 'critical',
          recommendedAction: inconsistency.conflictingSources.join(', '),
        });
      }
    }

    // Low cross-validation coverage
    if (validated.crossValidatedFacts.length < 5) {
      gaps.push({
        area: 'Cross-Validation Coverage',
        description: 'Insufficient cross-validated facts, need more diverse sources',
        severity: 'medium',
        recommendedAction: 'Alternative data providers, Industry reports',
      });
    }

    return gaps;
  }

  /**
   * Synthesize all results into final report
   */
  async synthesizeResults(allResults: Map<string, AgentExecutionResult>): Promise<FinalReport> {
    this.log('info', 'Synthesizing final report');

    // Extract results by agent type
    const financialResult = allResults.get('financial');
    const marketResult = allResults.get('market');
    const competitiveResult = allResults.get('competitive');
    const technologyResult = allResults.get('technology');
    const customerResult = allResults.get('customer');
    const newsResult = allResults.get('news');
    const riskResult = allResults.get('risk');

    // Create company overview (would be more sophisticated in real implementation)
    const companyOverview: CompanyOverview = {
      name: 'Target Company',
      domain: 'target.com',
      industry: 'Technology',
      description: 'Company under due diligence',
    };

    // Create executive summary
    const executiveSummary: ExecutiveSummary = this.createExecutiveSummary(allResults);

    return {
      diligenceId: `dd-${Date.now()}`,
      company: companyOverview,
      executiveSummary,
      financialAnalysis: financialResult?.data || {} as any,
      marketAnalysis: marketResult?.data || {} as any,
      competitiveAnalysis: competitiveResult?.data || {} as any,
      riskAssessment: riskResult?.data || {
        executionRisk: { score: 0, category: 'low' as const, description: '' },
        marketRisk: { score: 0, category: 'low' as const, description: '' },
        technologyRisk: { score: 0, category: 'low' as const, description: '' },
        financialRisk: { score: 0, category: 'low' as const, description: '' },
        regulatoryRisk: { score: 0, category: 'low' as const, description: '' },
        overallRiskScore: 0,
      },
      recommendations: [],
      generatedAt: new Date(),
    };
  }

  /**
   * Create executive summary from all results
   */
  private createExecutiveSummary(allResults: Map<string, AgentExecutionResult>): ExecutiveSummary {
    const keyFindings: string[] = [];
    const redFlags: string[] = [];
    const opportunities: string[] = [];

    // Analyze all results
    for (const [agentType, result] of allResults.entries()) {
      if (result.status === 'success') {
        keyFindings.push(`${agentType} analysis completed successfully`);
      }

      // Extract red flags from warnings and errors
      if (result.warnings.length > 0) {
        redFlags.push(...result.warnings);
      }
      if (result.errors.length > 0) {
        redFlags.push(...result.errors);
      }
    }

    // Calculate overall score based on results
    const successCount = Array.from(allResults.values()).filter(
      (r) => r.status === 'success'
    ).length;
    const totalCount = allResults.size;
    const overallScore = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    // Determine recommendation based on score and red flags
    let recommendation: ExecutiveSummary['recommendation'];
    if (redFlags.length > 5 || overallScore < 40) {
      recommendation = 'pass';
    } else if (redFlags.length > 2 || overallScore < 60) {
      recommendation = 'pass';
    } else if (overallScore < 75) {
      recommendation = 'hold';
    } else if (overallScore < 90) {
      recommendation = 'buy';
    } else {
      recommendation = 'strong_buy';
    }

    return {
      recommendation,
      keyFindings: keyFindings.slice(0, 10), // Top 10
      criticalRisks: redFlags.slice(0, 5).map(rf => ({
        category: 'General',
        severity: 'high' as const,
        description: rf,
        evidence: [],
        impact: 'Negative impact on investment thesis',
        recommendation: 'Further investigation required',
      })),
      investmentThesis: keyFindings.join('. '),
    };
  }

  /**
   * Helper method to create a task
   */
  private createTask(
    id: string,
    description: string,
    priority: Priority,
    dependencies: string[]
  ): Task {
    return {
      id,
      agentType: id,
      description,
      status: 'pending',
      priority,
      dependencies,
      createdAt: new Date(),
    };
  }

  /**
   * Estimate duration based on tasks and depth
   */
  private estimateDuration(tasks: Task[], depth: string): number {
    const baseTimePerTask = {
      standard: 5 * 60 * 1000, // 5 minutes
      deep: 15 * 60 * 1000, // 15 minutes
      exhaustive: 30 * 60 * 1000, // 30 minutes
    };

    const timePerTask = baseTimePerTask[depth as keyof typeof baseTimePerTask] || baseTimePerTask.standard;
    return tasks.length * timePerTask;
  }
}
