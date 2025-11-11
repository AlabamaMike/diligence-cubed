/**
 * Confidence Scoring Service
 * Calculates and validates confidence scores for findings with citation chains
 */

import { DatabaseClient } from '../database/client';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { Finding, Citation } from '../types/database';
import { logger } from '../utils/logger';

export interface ConfidenceFactors {
  source_quality: number; // 0-1: Quality of source documents
  citation_count: number; // Number of supporting citations
  cross_validation: number; // 0-1: Multiple sources confirm
  agent_expertise: number; // 0-1: Agent's domain expertise
  data_completeness: number; // 0-1: All required data available
  recency: number; // 0-1: How recent is the data
}

export interface ConfidenceBreakdown {
  overall_score: number; // 0-1
  factors: ConfidenceFactors;
  reasoning: string;
  recommendations: string[];
}

export class ConfidenceScoringService {
  private findingRepo: FindingRepository;

  constructor(private db: DatabaseClient) {
    this.findingRepo = new FindingRepository(db);
  }

  /**
   * Calculate confidence score for a finding based on multiple factors
   */
  async calculateConfidenceScore(
    findingId: string
  ): Promise<ConfidenceBreakdown> {
    const finding = await this.findingRepo.findById(findingId);
    if (!finding) {
      throw new Error(`Finding not found: ${findingId}`);
    }

    const citations = await this.findingRepo.getCitations(findingId);
    const relatedFindings = await this.findingRepo.getRelatedFindings(findingId);

    // Calculate individual factors
    const factors: ConfidenceFactors = {
      source_quality: await this.assessSourceQuality(citations),
      citation_count: this.assessCitationCount(citations.length),
      cross_validation: await this.assessCrossValidation(finding, relatedFindings),
      agent_expertise: this.assessAgentExpertise(finding.generated_by_agent, finding.category),
      data_completeness: this.assessDataCompleteness(finding, citations),
      recency: await this.assessRecency(citations),
    };

    // Weighted average for overall score
    const weights = {
      source_quality: 0.25,
      citation_count: 0.15,
      cross_validation: 0.20,
      agent_expertise: 0.15,
      data_completeness: 0.15,
      recency: 0.10,
    };

    const overallScore =
      factors.source_quality * weights.source_quality +
      factors.citation_count * weights.citation_count +
      factors.cross_validation * weights.cross_validation +
      factors.agent_expertise * weights.agent_expertise +
      factors.data_completeness * weights.data_completeness +
      factors.recency * weights.recency;

    const reasoning = this.generateReasoning(factors, overallScore);
    const recommendations = this.generateRecommendations(factors, overallScore);

    logger.info('Confidence score calculated', {
      findingId,
      overallScore: overallScore.toFixed(2),
    });

    return {
      overall_score: Math.round(overallScore * 100) / 100, // Round to 2 decimals
      factors,
      reasoning,
      recommendations,
    };
  }

  /**
   * Validate and adjust confidence score
   */
  async validateConfidenceScore(
    findingId: string,
    proposedScore: number
  ): Promise<{
    isValid: boolean;
    adjustedScore: number;
    validationNotes: string[];
  }> {
    const breakdown = await this.calculateConfidenceScore(findingId);
    const validationNotes: string[] = [];

    let adjustedScore = proposedScore;
    let isValid = true;

    // Check if proposed score is within acceptable range of calculated score
    const diff = Math.abs(proposedScore - breakdown.overall_score);
    if (diff > 0.2) {
      validationNotes.push(
        `Proposed score (${proposedScore.toFixed(2)}) differs significantly from calculated score (${breakdown.overall_score.toFixed(2)})`
      );
      adjustedScore = breakdown.overall_score;
      isValid = false;
    }

    // Ensure score is within valid range
    if (proposedScore < 0 || proposedScore > 1) {
      validationNotes.push('Score must be between 0.0 and 1.0');
      adjustedScore = Math.max(0, Math.min(1, proposedScore));
      isValid = false;
    }

    // Check for minimum citation requirement
    if (breakdown.factors.citation_count < 0.3 && proposedScore > 0.7) {
      validationNotes.push(
        'High confidence (>0.7) requires more supporting citations'
      );
      adjustedScore = Math.min(proposedScore, 0.7);
      isValid = false;
    }

    return {
      isValid,
      adjustedScore: Math.round(adjustedScore * 100) / 100,
      validationNotes,
    };
  }

  /**
   * Get confidence distribution for a deal
   */
  async getConfidenceDistribution(dealId: string): Promise<{
    high_confidence: number; // >0.8
    medium_confidence: number; // 0.5-0.8
    low_confidence: number; // <0.5
    avg_confidence: number;
    total_findings: number;
  }> {
    const result = await this.db.query<{
      high: string;
      medium: string;
      low: string;
      avg: string;
      total: string;
    }>(
      `SELECT
        COUNT(CASE WHEN confidence_score > 0.8 THEN 1 END) as high,
        COUNT(CASE WHEN confidence_score BETWEEN 0.5 AND 0.8 THEN 1 END) as medium,
        COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as low,
        AVG(confidence_score) as avg,
        COUNT(*) as total
      FROM findings
      WHERE deal_id = $1`,
      [dealId]
    );

    return {
      high_confidence: parseInt(result.rows[0]?.high || '0'),
      medium_confidence: parseInt(result.rows[0]?.medium || '0'),
      low_confidence: parseInt(result.rows[0]?.low || '0'),
      avg_confidence: parseFloat(result.rows[0]?.avg || '0'),
      total_findings: parseInt(result.rows[0]?.total || '0'),
    };
  }

  // ============================================================================
  // FACTOR ASSESSMENT METHODS
  // ============================================================================

  /**
   * Assess quality of source documents
   * @private
   */
  private async assessSourceQuality(citations: Citation[]): Promise<number> {
    if (citations.length === 0) return 0.3; // Minimal score with no citations

    let totalQuality = 0;

    for (const citation of citations) {
      // Get document details
      const docResult = await this.db.query<{
        document_type: string;
        tags: string[];
        classification_confidence: number;
      }>(
        `SELECT document_type, tags, classification_confidence FROM documents WHERE id = $1`,
        [citation.document_id]
      );

      if (docResult.rows.length === 0) continue;

      const doc = docResult.rows[0];
      let quality = 0.5; // Base quality

      // High-quality document types
      const highQualityTypes = [
        'financial_statement',
        'contract',
        'tax_return',
        'pitch_deck',
      ];
      if (highQualityTypes.includes(doc.document_type)) {
        quality += 0.2;
      }

      // Audited or verified documents
      if (doc.tags?.includes('audited') || doc.tags?.includes('verified')) {
        quality += 0.2;
      }

      // Classification confidence
      if (doc.classification_confidence) {
        quality += doc.classification_confidence * 0.1;
      }

      totalQuality += Math.min(1, quality);
    }

    return totalQuality / citations.length;
  }

  /**
   * Assess citation count adequacy
   * @private
   */
  private assessCitationCount(count: number): number {
    // Sigmoid-like function: more citations = higher confidence
    if (count === 0) return 0;
    if (count === 1) return 0.4;
    if (count === 2) return 0.6;
    if (count === 3) return 0.75;
    if (count >= 5) return 1.0;
    return 0.85; // 4 citations
  }

  /**
   * Assess cross-validation from related findings
   * @private
   */
  private async assessCrossValidation(
    finding: Finding,
    relatedFindings: Finding[]
  ): Promise<number> {
    if (relatedFindings.length === 0) return 0.5; // Neutral

    // Check for supporting vs contradicting findings
    const references = await this.findingRepo.getReferencesFrom(finding.id);

    const supportingCount = references.filter(
      (r) => r.reference_type === 'supports'
    ).length;
    const contradictingCount = references.filter(
      (r) => r.reference_type === 'contradicts'
    ).length;

    if (contradictingCount > supportingCount) {
      return 0.2; // Low confidence if contradicted
    }

    if (supportingCount > 0) {
      return Math.min(1.0, 0.6 + supportingCount * 0.15);
    }

    return 0.5; // Neutral if no references
  }

  /**
   * Assess agent expertise for finding category
   * @private
   */
  private assessAgentExpertise(agentType: string, category?: string): number {
    // Agent domain expertise mapping
    const expertise: Record<string, string[]> = {
      financial: [
        'financial_analysis',
        'qoe',
        'working_capital',
        'debt_capacity',
        'synergies',
      ],
      commercial: [
        'market_analysis',
        'competitive_analysis',
        'customer_analysis',
        'pricing_analysis',
      ],
      technical: [
        'architecture',
        'technical_debt',
        'security',
        'development_metrics',
      ],
      operational: [
        'organizational_effectiveness',
        'supply_chain',
        'operational_kpis',
        'integration_readiness',
      ],
      orchestrator: ['phase_management', 'synthesis'],
      ingestion: ['document_classification'],
    };

    if (!category) return 0.7; // Default

    const agentExpertise = expertise[agentType] || [];
    if (agentExpertise.some((cat) => category.includes(cat))) {
      return 0.95; // High expertise
    }

    return 0.6; // Out of domain
  }

  /**
   * Assess data completeness
   * @private
   */
  private assessDataCompleteness(finding: Finding, citations: Citation[]): number {
    let score = 0.5; // Base

    // Has description
    if (finding.description && finding.description.length > 100) {
      score += 0.15;
    }

    // Has agent reasoning
    if (finding.agent_reasoning) {
      score += 0.10;
    }

    // Has citations
    if (citations.length > 0) {
      score += 0.15;
    }

    // Has financial impact
    if (finding.financial_impact_usd !== null && finding.financial_impact_usd !== undefined) {
      score += 0.10;
    }

    return Math.min(1, score);
  }

  /**
   * Assess recency of source data
   * @private
   */
  private async assessRecency(citations: Citation[]): Promise<number> {
    if (citations.length === 0) return 0.5;

    const now = new Date();
    let totalRecency = 0;

    for (const citation of citations) {
      const docResult = await this.db.query<{ uploaded_at: Date }>(
        `SELECT uploaded_at FROM documents WHERE id = $1`,
        [citation.document_id]
      );

      if (docResult.rows.length === 0) continue;

      const uploadDate = new Date(docResult.rows[0].uploaded_at);
      const daysOld = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);

      // Recency decay: 1.0 for recent, decreases over time
      let recency = 1.0;
      if (daysOld > 365) {
        recency = 0.5; // >1 year old
      } else if (daysOld > 180) {
        recency = 0.7; // 6-12 months
      } else if (daysOld > 90) {
        recency = 0.85; // 3-6 months
      }

      totalRecency += recency;
    }

    return totalRecency / citations.length;
  }

  // ============================================================================
  // REASONING & RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate reasoning for confidence score
   * @private
   */
  private generateReasoning(factors: ConfidenceFactors, overall: number): string {
    const parts: string[] = [];

    if (overall > 0.8) {
      parts.push('High confidence finding based on');
    } else if (overall > 0.5) {
      parts.push('Moderate confidence finding based on');
    } else {
      parts.push('Low confidence finding based on');
    }

    const topFactors = Object.entries(factors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    parts.push(
      topFactors
        .map(([key, value]) => `${key.replace(/_/g, ' ')} (${(value * 100).toFixed(0)}%)`)
        .join(', ')
    );

    return parts.join(' ');
  }

  /**
   * Generate recommendations for improving confidence
   * @private
   */
  private generateRecommendations(factors: ConfidenceFactors, overall: number): string[] {
    const recommendations: string[] = [];

    if (overall >= 0.8) {
      return ['Confidence score is high - no additional validation required'];
    }

    if (factors.citation_count < 0.5) {
      recommendations.push('Add more supporting citations from source documents');
    }

    if (factors.source_quality < 0.6) {
      recommendations.push('Seek higher-quality source documents (audited, verified)');
    }

    if (factors.cross_validation < 0.6) {
      recommendations.push('Cross-validate finding with other agents or sources');
    }

    if (factors.data_completeness < 0.7) {
      recommendations.push('Provide more detailed reasoning and context');
    }

    if (factors.recency < 0.7) {
      recommendations.push('Update with more recent data if available');
    }

    if (recommendations.length === 0) {
      recommendations.push('Consider manual review to verify accuracy');
    }

    return recommendations;
  }
}
