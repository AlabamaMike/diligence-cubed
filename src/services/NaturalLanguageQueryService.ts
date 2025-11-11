/**
 * Natural Language Query Service
 * Provides conversational interface to all domain agents
 */

import { DatabaseClient } from '../database/client';
import { FinancialDomainAgent } from '../agents/FinancialDomainAgent';
import { CommercialDomainAgent } from '../agents/CommercialDomainAgent';
import { TechnicalDomainAgent } from '../agents/TechnicalDomainAgent';
import { OperationalDomainAgent } from '../agents/OperationalDomainAgent';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { AuditService } from './AuditService';
import { logger } from '../utils/logger';

export interface QueryResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    finding_id: string;
    title: string;
    relevance: number;
  }>;
  suggested_followups: string[];
  agent_used: string;
}

export interface QueryContext {
  deal_id: string;
  user_id: string;
  conversation_history?: Array<{
    query: string;
    response: string;
    timestamp: Date;
  }>;
}

export class NaturalLanguageQueryService {
  private findingRepo: FindingRepository;
  private auditService: AuditService;

  constructor(private db: DatabaseClient) {
    this.findingRepo = new FindingRepository(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Process natural language query and route to appropriate agent
   */
  async query(queryText: string, context: QueryContext): Promise<QueryResponse> {
    logger.info('Processing NL query', {
      dealId: context.deal_id,
      userId: context.user_id,
      queryLength: queryText.length,
    });

    // Log query
    await this.auditService.logQueryExecution(
      context.deal_id,
      context.user_id,
      queryText,
      'natural_language_interface'
    );

    // Determine query intent and route to appropriate agent
    const intent = this.classifyQueryIntent(queryText);
    const agentType = this.routeToAgent(intent);

    // Search existing findings first
    const relevantFindings = await this.searchFindings(queryText, context.deal_id, agentType);

    // Generate response based on findings
    const response = await this.generateResponse(queryText, intent, relevantFindings, agentType);

    // Calculate confidence
    const confidence = this.calculateResponseConfidence(relevantFindings);

    // Generate follow-up suggestions
    const suggestedFollowups = this.generateFollowupQuestions(intent, agentType);

    logger.info('NL query processed', {
      dealId: context.deal_id,
      agentUsed: agentType,
      findingsFound: relevantFindings.length,
      confidence,
    });

    return {
      answer: response,
      confidence,
      sources: relevantFindings.map((f) => ({
        finding_id: f.id,
        title: f.title,
        relevance: f.confidence_score,
      })),
      suggested_followups: suggestedFollowups,
      agent_used: agentType,
    };
  }

  /**
   * Classify query intent
   * @private
   */
  private classifyQueryIntent(query: string): {
    domain: string;
    intent_type: string;
    keywords: string[];
  } {
    const queryLower = query.toLowerCase();

    // Financial keywords
    const financialKeywords = [
      'revenue',
      'ebitda',
      'profit',
      'cash flow',
      'working capital',
      'debt',
      'valuation',
      'earnings',
      'margin',
      'qoe',
      'quality of earnings',
      'financial',
      'synergy',
      'synergies',
    ];

    // Commercial keywords
    const commercialKeywords = [
      'market',
      'customer',
      'competition',
      'competitor',
      'pricing',
      'sales',
      'tam',
      'sam',
      'som',
      'market share',
      'churn',
      'retention',
      'commercial',
    ];

    // Technical keywords
    const technicalKeywords = [
      'technology',
      'architecture',
      'code',
      'technical debt',
      'security',
      'infrastructure',
      'development',
      'devops',
      'technical',
      'software',
      'system',
      'api',
    ];

    // Operational keywords
    const operationalKeywords = [
      'organization',
      'employees',
      'team',
      'supply chain',
      'vendor',
      'operational',
      'efficiency',
      'integration',
      'process',
      'headcount',
    ];

    const matchedKeywords: string[] = [];
    let domain = 'general';
    let intentType = 'question';

    // Detect domain
    const financialMatches = financialKeywords.filter((kw) => queryLower.includes(kw));
    const commercialMatches = commercialKeywords.filter((kw) => queryLower.includes(kw));
    const technicalMatches = technicalKeywords.filter((kw) => queryLower.includes(kw));
    const operationalMatches = operationalKeywords.filter((kw) => queryLower.includes(kw));

    if (financialMatches.length > 0) {
      domain = 'financial';
      matchedKeywords.push(...financialMatches);
    } else if (commercialMatches.length > 0) {
      domain = 'commercial';
      matchedKeywords.push(...commercialMatches);
    } else if (technicalMatches.length > 0) {
      domain = 'technical';
      matchedKeywords.push(...technicalMatches);
    } else if (operationalMatches.length > 0) {
      domain = 'operational';
      matchedKeywords.push(...operationalMatches);
    }

    // Detect intent type
    if (queryLower.includes('what is') || queryLower.includes('what are')) {
      intentType = 'definition';
    } else if (queryLower.includes('how') || queryLower.includes('why')) {
      intentType = 'explanation';
    } else if (
      queryLower.includes('calculate') ||
      queryLower.includes('analyze') ||
      queryLower.includes('assess')
    ) {
      intentType = 'analysis_request';
    } else if (queryLower.includes('red flag') || queryLower.includes('risk')) {
      intentType = 'risk_inquiry';
    }

    return {
      domain,
      intent_type: intentType,
      keywords: matchedKeywords,
    };
  }

  /**
   * Route query to appropriate agent
   * @private
   */
  private routeToAgent(intent: { domain: string }): string {
    const routingMap: Record<string, string> = {
      financial: 'financial',
      commercial: 'commercial',
      technical: 'technical',
      operational: 'operational',
      general: 'orchestrator',
    };

    return routingMap[intent.domain] || 'orchestrator';
  }

  /**
   * Search for relevant findings
   * @private
   */
  private async searchFindings(
    query: string,
    dealId: string,
    agentType: string
  ): Promise<any[]> {
    // Simple keyword-based search
    // In production, would use vector embeddings for semantic search
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((w) => w.length > 3);

    let findings = await this.findingRepo.findByDeal(dealId, {
      limit: 100,
      offset: 0,
    });

    // Filter by agent if not orchestrator
    if (agentType !== 'orchestrator') {
      findings = findings.filter((f) => f.generated_by_agent === agentType);
    }

    // Score findings by keyword relevance
    const scoredFindings = findings.map((finding) => {
      const titleLower = finding.title.toLowerCase();
      const descLower = finding.description.toLowerCase();
      const combined = `${titleLower} ${descLower}`;

      let score = 0;
      for (const keyword of keywords) {
        if (combined.includes(keyword)) {
          score += 1;
        }
      }

      // Boost for exact phrase match
      if (combined.includes(queryLower)) {
        score += 5;
      }

      return { finding, score };
    });

    // Return top 5 most relevant
    return scoredFindings
      .filter((sf) => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((sf) => sf.finding);
  }

  /**
   * Generate response from findings
   * @private
   */
  private async generateResponse(
    query: string,
    intent: any,
    findings: any[],
    agentType: string
  ): Promise<string> {
    if (findings.length === 0) {
      return this.generateNoFindingsResponse(query, intent, agentType);
    }

    // Build response from findings
    const parts: string[] = [];

    // Add contextual intro
    if (intent.intent_type === 'definition') {
      parts.push(`Based on our ${agentType} analysis:\n`);
    } else if (intent.intent_type === 'risk_inquiry') {
      parts.push(`Here are the key ${agentType} risks identified:\n`);
    } else {
      parts.push(`Regarding your question about ${intent.keywords.join(', ')}:\n`);
    }

    // Add findings
    for (let i = 0; i < Math.min(3, findings.length); i++) {
      const finding = findings[i];
      parts.push(`\n**${finding.title}**`);

      // Include relevant excerpt from description
      const excerpt = this.extractRelevantExcerpt(finding.description, intent.keywords);
      parts.push(excerpt);

      if (finding.impact_level && finding.impact_level !== 'low') {
        parts.push(`*Impact: ${finding.impact_level}*`);
      }
    }

    // Add summary if multiple findings
    if (findings.length > 3) {
      parts.push(`\n_Plus ${findings.length - 3} additional related findings._`);
    }

    return parts.join('\n');
  }

  /**
   * Generate response when no findings found
   * @private
   */
  private generateNoFindingsResponse(
    query: string,
    intent: any,
    agentType: string
  ): string {
    return `I don't have specific ${agentType} findings that directly answer "${query}".

This could mean:
- The ${agentType} analysis hasn't been completed yet
- The specific topic hasn't been analyzed
- Different terminology was used in the analysis

Try:
- Asking a more general question about ${agentType} findings
- Checking if the ${agentType} workstream has been completed
- Requesting a new ${agentType} analysis on this topic`;
  }

  /**
   * Extract relevant excerpt from text
   * @private
   */
  private extractRelevantExcerpt(text: string, keywords: string[]): string {
    // Find sentences containing keywords
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (keywords.some((kw) => sentenceLower.includes(kw))) {
        return sentence.trim() + '.';
      }
    }

    // Fallback: return first 200 chars
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }

  /**
   * Calculate response confidence
   * @private
   */
  private calculateResponseConfidence(findings: any[]): number {
    if (findings.length === 0) return 0.3;

    // Average confidence of findings
    const avgConfidence =
      findings.reduce((sum, f) => sum + f.confidence_score, 0) / findings.length;

    // Adjust based on number of findings
    let confidence = avgConfidence;
    if (findings.length >= 3) {
      confidence += 0.1; // Boost for multiple corroborating findings
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Generate follow-up question suggestions
   * @private
   */
  private generateFollowupQuestions(intent: any, agentType: string): string[] {
    const suggestions: Record<string, string[]> = {
      financial: [
        'What are the main QoE adjustments?',
        'What is the normalized working capital?',
        'What are the identified synergies?',
        'What is the debt capacity?',
      ],
      commercial: [
        'What is the market size?',
        'Who are the main competitors?',
        'What is the customer concentration?',
        'What is the pricing power assessment?',
      ],
      technical: [
        'What is the technical debt level?',
        'Are there any critical security vulnerabilities?',
        'What is the architecture assessment?',
        'What are the development metrics?',
      ],
      operational: [
        'What is the organizational effectiveness score?',
        'What are the supply chain risks?',
        'What is the integration complexity?',
        'What are the operational KPIs?',
      ],
      orchestrator: [
        'What is the current phase?',
        'What are the high priority findings?',
        'What red flags have been identified?',
        'What is the overall deal summary?',
      ],
    };

    return suggestions[agentType] || suggestions.orchestrator;
  }

  /**
   * Get query suggestions for a deal
   */
  async getQuerySuggestions(dealId: string): Promise<string[]> {
    // Get deal phase
    const dealResult = await this.db.query<{ current_phase: string }>(
      'SELECT current_phase FROM deals WHERE id = $1',
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return [];
    }

    const phase = dealResult.rows[0].current_phase;

    // Phase-specific suggestions
    const phaseSuggestions: Record<string, string[]> = {
      discovery: [
        'What documents have been uploaded?',
        'What is the company overview?',
        'What initial findings have been identified?',
      ],
      deep_dive: [
        'What are the financial highlights?',
        'What are the main market opportunities?',
        'What technical risks have been found?',
        'What are the operational strengths?',
      ],
      validation: [
        'What findings need validation?',
        'What are the high-priority red flags?',
        'What is the confidence level of key findings?',
      ],
      synthesis: [
        'What is the investment recommendation?',
        'What are the deal-breakers?',
        'What is the overall risk assessment?',
        'What are the key value drivers?',
      ],
      completed: [
        'What was the final recommendation?',
        'What were the critical success factors?',
        'What lessons were learned?',
      ],
    };

    return phaseSuggestions[phase] || phaseSuggestions.discovery;
  }
}
