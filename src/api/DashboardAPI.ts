/**
 * Dashboard API
 * REST endpoints for deal summaries, progress tracking, and analytics
 */

import { DatabaseClient } from '../database/client';
import { DealRepository } from '../database/repositories/DealRepository';
import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { ConfidenceScoringService } from '../services/ConfidenceScoringService';
import { InterAgentCommunicationService } from '../services/InterAgentCommunicationService';
import { logger } from '../utils/logger';
import { DealPhase, DealStatus } from '../types/database';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DealOverview {
  deal_id: string;
  deal_name: string;
  target_company: string;
  deal_type: string;
  current_phase: DealPhase;
  status: DealStatus;
  created_at: Date;
  target_close_date?: Date;
  progress_pct: number;
  health_status: 'on_track' | 'at_risk' | 'delayed';
  key_metrics: {
    total_documents: number;
    processed_documents: number;
    total_findings: number;
    red_flags: number;
    avg_confidence: number;
  };
}

export interface PhaseProgress {
  phase: DealPhase;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_pct: number;
  workstreams: Array<{
    name: string;
    status: 'not_started' | 'in_progress' | 'completed';
    progress_pct: number;
    findings_count: number;
    documents_count: number;
  }>;
  completion_criteria: Array<{
    criterion: string;
    satisfied: boolean;
    details: string;
  }>;
}

export interface WorkstreamMetrics {
  workstream_id: string;
  name: string;
  phase: string;
  assigned_agent: string;
  status: string;
  progress_pct: number;
  documents_count: number;
  findings_count: number;
  high_priority_findings: number;
  avg_confidence: number;
  last_activity: Date;
}

export interface FindingDistribution {
  by_category: Record<string, number>;
  by_impact: Record<string, number>;
  by_status: Record<string, number>;
  by_agent: Record<string, number>;
  confidence_levels: {
    high: number; // >0.8
    medium: number; // 0.5-0.8
    low: number; // <0.5
  };
}

export interface TimelineEvent {
  timestamp: Date;
  event_type: 'phase_transition' | 'document_upload' | 'finding_created' | 'red_flag' | 'milestone';
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface DealHealthMetrics {
  overall_health: 'healthy' | 'warning' | 'critical';
  factors: {
    document_processing: { score: number; status: string };
    findings_quality: { score: number; status: string };
    phase_progress: { score: number; status: string };
    red_flag_count: { score: number; status: string };
    timeline_adherence: { score: number; status: string };
  };
  recommendations: string[];
}

export interface AgentActivity {
  agent_id: string;
  agent_name: string;
  findings_created: number;
  last_active: Date;
  avg_confidence: number;
  workstreams_assigned: number;
  status: 'active' | 'idle' | 'blocked';
}

export interface KPIDashboard {
  deal_id: string;
  as_of_date: Date;
  kpis: {
    // Document metrics
    documents_processed: number;
    documents_pending: number;
    processing_velocity: number; // docs per day

    // Finding metrics
    total_findings: number;
    high_impact_findings: number;
    red_flags: number;
    validation_rate: number; // % validated

    // Quality metrics
    avg_confidence_score: number;
    citation_coverage: number; // % findings with citations
    cross_validation_rate: number; // % findings cross-validated

    // Collaboration metrics
    inter_agent_messages: number;
    active_dependencies: number;
    collaborative_tasks: number;

    // Timeline metrics
    days_elapsed: number;
    days_remaining?: number;
    phase_completion_pct: number;
  };
  trends: {
    documents_processed_trend: number[]; // Last 7 days
    findings_created_trend: number[];
    confidence_trend: number[];
  };
}

// ============================================================================
// DASHBOARD API SERVICE
// ============================================================================

export class DashboardAPI {
  private dealRepo: DealRepository;
  private docRepo: DocumentRepository;
  private findingRepo: FindingRepository;
  private confidenceService: ConfidenceScoringService;
  private commService: InterAgentCommunicationService;

  constructor(private db: DatabaseClient) {
    this.dealRepo = new DealRepository(db);
    this.docRepo = new DocumentRepository(db);
    this.findingRepo = new FindingRepository(db);
    this.confidenceService = new ConfidenceScoringService(db);
    this.commService = new InterAgentCommunicationService(db);
  }

  // ==========================================================================
  // DEAL OVERVIEW & SUMMARY
  // ==========================================================================

  /**
   * Get comprehensive deal overview
   */
  async getDealOverview(dealId: string): Promise<DealOverview> {
    logger.info('Fetching deal overview', { dealId });

    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Get key metrics
    const [docStats, findingStats, confidenceDist] = await Promise.all([
      this.docRepo.getStatistics(dealId),
      this.getBasicFindingStats(dealId),
      this.confidenceService.getConfidenceDistribution(dealId),
    ]);

    // Calculate overall progress
    const progressPct = await this.calculateDealProgress(dealId);

    // Determine health status
    const healthStatus = await this.assessDealHealth(dealId, deal, findingStats);

    return {
      deal_id: dealId,
      deal_name: deal.name,
      target_company: deal.target_company,
      deal_type: deal.deal_type,
      current_phase: deal.current_phase,
      status: deal.status,
      created_at: deal.created_at,
      target_close_date: deal.target_close_date,
      progress_pct: progressPct,
      health_status: healthStatus,
      key_metrics: {
        total_documents: docStats.total,
        processed_documents: docStats.by_status.processed || 0,
        total_findings: findingStats.total,
        red_flags: findingStats.red_flags,
        avg_confidence: confidenceDist.avg_confidence,
      },
    };
  }

  /**
   * Get phase-by-phase progress breakdown
   */
  async getPhaseProgress(dealId: string): Promise<PhaseProgress[]> {
    logger.info('Fetching phase progress', { dealId });

    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    const phases: DealPhase[] = ['discovery', 'deep_dive', 'validation', 'synthesis'];
    const progressData: PhaseProgress[] = [];

    for (const phase of phases) {
      // Get workstreams for this phase
      const workstreamsResult = await this.db.query<{
        id: string;
        name: string;
        status: string;
      }>(
        `SELECT id, name, status FROM workstreams
         WHERE deal_id = $1 AND phase = $2`,
        [dealId, phase]
      );

      const workstreams = await Promise.all(
        workstreamsResult.rows.map(async (ws) => {
          const metrics = await this.getWorkstreamMetrics(ws.id);
          return {
            name: ws.name,
            status: ws.status as any,
            progress_pct: metrics.progress_pct,
            findings_count: metrics.findings_count,
            documents_count: metrics.documents_count,
          };
        })
      );

      // Calculate phase progress
      const phaseProgressPct =
        workstreams.length > 0
          ? workstreams.reduce((sum, ws) => sum + ws.progress_pct, 0) / workstreams.length
          : 0;

      // Determine phase status
      let phaseStatus: 'not_started' | 'in_progress' | 'completed' = 'not_started';
      if (deal.current_phase === phase) {
        phaseStatus = 'in_progress';
      } else if (phases.indexOf(deal.current_phase) > phases.indexOf(phase)) {
        phaseStatus = 'completed';
      }

      // Get completion criteria
      const completionCriteria = await this.getPhaseCompletionCriteria(dealId, phase);

      progressData.push({
        phase,
        status: phaseStatus,
        progress_pct: phaseProgressPct,
        workstreams,
        completion_criteria: completionCriteria,
      });
    }

    return progressData;
  }

  /**
   * Get all workstream metrics for a deal
   */
  async getWorkstreamMetrics(workstreamId: string): Promise<WorkstreamMetrics> {
    logger.info('Fetching workstream metrics', { workstreamId });

    const wsResult = await this.db.query<{
      id: string;
      name: string;
      phase: string;
      assigned_agent: string;
      status: string;
      updated_at: Date;
    }>(
      'SELECT id, name, phase, assigned_agent, status, updated_at FROM workstreams WHERE id = $1',
      [workstreamId]
    );

    if (wsResult.rows.length === 0) {
      throw new Error(`Workstream not found: ${workstreamId}`);
    }

    const ws = wsResult.rows[0];

    // Get document count
    const docCountResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM documents WHERE workstream_id = $1',
      [workstreamId]
    );

    // Get finding stats
    const findingStatsResult = await this.db.query<{
      total: string;
      high_priority: string;
      avg_confidence: string;
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN impact_level = 'critical' OR impact_level = 'high' THEN 1 END) as high_priority,
        AVG(confidence_score) as avg_confidence
       FROM findings
       WHERE workstream_id = $1`,
      [workstreamId]
    );

    const findingStats = findingStatsResult.rows[0];

    // Calculate progress based on findings and document processing
    const progressPct = ws.status === 'completed' ? 100 : ws.status === 'in_progress' ? 60 : 0;

    return {
      workstream_id: ws.id,
      name: ws.name,
      phase: ws.phase,
      assigned_agent: ws.assigned_agent,
      status: ws.status,
      progress_pct: progressPct,
      documents_count: parseInt(docCountResult.rows[0]?.count || '0'),
      findings_count: parseInt(findingStats?.total || '0'),
      high_priority_findings: parseInt(findingStats?.high_priority || '0'),
      avg_confidence: parseFloat(findingStats?.avg_confidence || '0'),
      last_activity: ws.updated_at,
    };
  }

  // ==========================================================================
  // FINDING ANALYTICS
  // ==========================================================================

  /**
   * Get finding distribution breakdown
   */
  async getFindingDistribution(dealId: string): Promise<FindingDistribution> {
    logger.info('Fetching finding distribution', { dealId });

    const [categoryResult, impactResult, statusResult, agentResult, confidenceDist] = await Promise.all([
      this.db.query<{ category: string; count: string }>(
        `SELECT category, COUNT(*) as count
         FROM findings WHERE deal_id = $1
         GROUP BY category`,
        [dealId]
      ),
      this.db.query<{ impact_level: string; count: string }>(
        `SELECT impact_level, COUNT(*) as count
         FROM findings WHERE deal_id = $1
         GROUP BY impact_level`,
        [dealId]
      ),
      this.db.query<{ validation_status: string; count: string }>(
        `SELECT validation_status, COUNT(*) as count
         FROM findings WHERE deal_id = $1
         GROUP BY validation_status`,
        [dealId]
      ),
      this.db.query<{ generated_by_agent: string; count: string }>(
        `SELECT generated_by_agent, COUNT(*) as count
         FROM findings WHERE deal_id = $1
         GROUP BY generated_by_agent`,
        [dealId]
      ),
      this.confidenceService.getConfidenceDistribution(dealId),
    ]);

    const byCategory: Record<string, number> = {};
    categoryResult.rows.forEach((row) => {
      byCategory[row.category] = parseInt(row.count);
    });

    const byImpact: Record<string, number> = {};
    impactResult.rows.forEach((row) => {
      byImpact[row.impact_level] = parseInt(row.count);
    });

    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach((row) => {
      byStatus[row.validation_status] = parseInt(row.count);
    });

    const byAgent: Record<string, number> = {};
    agentResult.rows.forEach((row) => {
      byAgent[row.generated_by_agent] = parseInt(row.count);
    });

    return {
      by_category: byCategory,
      by_impact: byImpact,
      by_status: byStatus,
      by_agent: byAgent,
      confidence_levels: {
        high: confidenceDist.high_confidence,
        medium: confidenceDist.medium_confidence,
        low: confidenceDist.low_confidence,
      },
    };
  }

  // ==========================================================================
  // TIMELINE & ACTIVITY
  // ==========================================================================

  /**
   * Get deal timeline events
   */
  async getTimeline(dealId: string, limit: number = 50): Promise<TimelineEvent[]> {
    logger.info('Fetching deal timeline', { dealId });

    const auditResult = await this.db.query<{
      created_at: Date;
      action_type: string;
      details: any;
      metadata: any;
    }>(
      `SELECT created_at, action_type, details, metadata
       FROM audit_logs
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [dealId, limit]
    );

    return auditResult.rows.map((log) => {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;

      // Map audit action types to timeline event types
      let eventType: TimelineEvent['event_type'] = 'milestone';
      if (log.action_type === 'phase_transition') eventType = 'phase_transition';
      else if (log.action_type === 'document_upload') eventType = 'document_upload';
      else if (log.action_type === 'finding_created') eventType = 'finding_created';
      else if (log.action_type.includes('red_flag')) eventType = 'red_flag';

      return {
        timestamp: log.created_at,
        event_type: eventType,
        title: this.formatEventTitle(log.action_type, details),
        description: details?.description || '',
        metadata: metadata || {},
      };
    });
  }

  /**
   * Get agent activity summary
   */
  async getAgentActivity(dealId: string): Promise<AgentActivity[]> {
    logger.info('Fetching agent activity', { dealId });

    const activityResult = await this.db.query<{
      generated_by_agent: string;
      findings_count: string;
      last_active: Date;
      avg_confidence: string;
    }>(
      `SELECT
        generated_by_agent,
        COUNT(*) as findings_count,
        MAX(created_at) as last_active,
        AVG(confidence_score) as avg_confidence
       FROM findings
       WHERE deal_id = $1
       GROUP BY generated_by_agent`,
      [dealId]
    );

    const workstreamAssignments = await this.db.query<{
      assigned_agent: string;
      count: string;
    }>(
      `SELECT assigned_agent, COUNT(*) as count
       FROM workstreams
       WHERE deal_id = $1
       GROUP BY assigned_agent`,
      [dealId]
    );

    const assignmentMap: Record<string, number> = {};
    workstreamAssignments.rows.forEach((row) => {
      assignmentMap[row.assigned_agent] = parseInt(row.count);
    });

    return activityResult.rows.map((row) => {
      const lastActiveDate = new Date(row.last_active);
      const hoursSinceActive = (Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60);

      let status: 'active' | 'idle' | 'blocked' = 'active';
      if (hoursSinceActive > 48) status = 'idle';

      return {
        agent_id: row.generated_by_agent,
        agent_name: this.formatAgentName(row.generated_by_agent),
        findings_created: parseInt(row.findings_count),
        last_active: lastActiveDate,
        avg_confidence: parseFloat(row.avg_confidence),
        workstreams_assigned: assignmentMap[row.generated_by_agent] || 0,
        status,
      };
    });
  }

  // ==========================================================================
  // HEALTH & KPI METRICS
  // ==========================================================================

  /**
   * Assess overall deal health
   */
  async getDealHealth(dealId: string): Promise<DealHealthMetrics> {
    logger.info('Assessing deal health', { dealId });

    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Calculate individual health factors
    const docProcessingScore = await this.calculateDocumentProcessingScore(dealId);
    const findingsQualityScore = await this.calculateFindingsQualityScore(dealId);
    const phaseProgressScore = await this.calculatePhaseProgressScore(dealId);
    const redFlagScore = await this.calculateRedFlagScore(dealId);
    const timelineScore = await this.calculateTimelineAdherenceScore(deal);

    // Calculate overall health (weighted average)
    const overallScore =
      docProcessingScore.score * 0.2 +
      findingsQualityScore.score * 0.25 +
      phaseProgressScore.score * 0.25 +
      redFlagScore.score * 0.15 +
      timelineScore.score * 0.15;

    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (overallScore < 50) overallHealth = 'critical';
    else if (overallScore < 75) overallHealth = 'warning';

    // Generate recommendations
    const recommendations = this.generateHealthRecommendations({
      docProcessingScore,
      findingsQualityScore,
      phaseProgressScore,
      redFlagScore,
      timelineScore,
    });

    return {
      overall_health: overallHealth,
      factors: {
        document_processing: docProcessingScore,
        findings_quality: findingsQualityScore,
        phase_progress: phaseProgressScore,
        red_flag_count: redFlagScore,
        timeline_adherence: timelineScore,
      },
      recommendations,
    };
  }

  /**
   * Get comprehensive KPI dashboard
   */
  async getKPIDashboard(dealId: string): Promise<KPIDashboard> {
    logger.info('Generating KPI dashboard', { dealId });

    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Get all metrics
    const [
      docStats,
      findingStats,
      confidenceDist,
      commStats,
      processingVelocity,
      trends,
    ] = await Promise.all([
      this.docRepo.getStatistics(dealId),
      this.getBasicFindingStats(dealId),
      this.confidenceService.getConfidenceDistribution(dealId),
      this.commService.getCommunicationStats(dealId),
      this.calculateProcessingVelocity(dealId),
      this.calculateTrends(dealId),
    ]);

    // Calculate validation rate
    const validationRate = findingStats.total > 0
      ? (findingStats.validated / findingStats.total) * 100
      : 0;

    // Calculate citation coverage
    const citationCoverage = findingStats.total > 0
      ? (findingStats.with_citations / findingStats.total) * 100
      : 0;

    // Calculate timeline metrics
    const daysElapsed = Math.floor(
      (Date.now() - deal.created_at.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = deal.target_close_date
      ? Math.floor((deal.target_close_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined;

    const phaseCompletionPct = await this.calculateDealProgress(dealId);

    return {
      deal_id: dealId,
      as_of_date: new Date(),
      kpis: {
        documents_processed: docStats.by_status.processed || 0,
        documents_pending: docStats.by_status.pending || 0,
        processing_velocity: processingVelocity,
        total_findings: findingStats.total,
        high_impact_findings: findingStats.high_impact,
        red_flags: findingStats.red_flags,
        validation_rate: validationRate,
        avg_confidence_score: confidenceDist.avg_confidence,
        citation_coverage: citationCoverage,
        cross_validation_rate: findingStats.cross_validated_rate,
        inter_agent_messages: commStats.total_messages,
        active_dependencies: commStats.active_dependencies,
        collaborative_tasks: commStats.active_tasks,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        phase_completion_pct: phaseCompletionPct,
      },
      trends,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async getBasicFindingStats(dealId: string): Promise<{
    total: number;
    red_flags: number;
    high_impact: number;
    validated: number;
    with_citations: number;
    cross_validated_rate: number;
  }> {
    const result = await this.db.query<{
      total: string;
      red_flags: string;
      high_impact: string;
      validated: string;
      with_citations: string;
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_red_flag = true THEN 1 END) as red_flags,
        COUNT(CASE WHEN impact_level IN ('critical', 'high') THEN 1 END) as high_impact,
        COUNT(CASE WHEN validation_status = 'validated' THEN 1 END) as validated,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM citations WHERE finding_id = findings.id
        ) THEN findings.id END) as with_citations
       FROM findings
       WHERE deal_id = $1`,
      [dealId]
    );

    const row = result.rows[0];

    return {
      total: parseInt(row?.total || '0'),
      red_flags: parseInt(row?.red_flags || '0'),
      high_impact: parseInt(row?.high_impact || '0'),
      validated: parseInt(row?.validated || '0'),
      with_citations: parseInt(row?.with_citations || '0'),
      cross_validated_rate: 0.75, // Mock - would calculate from inter_agent_references
    };
  }

  private async calculateDealProgress(dealId: string): Promise<number> {
    // Simple progress calculation based on phase
    const deal = await this.dealRepo.findById(dealId);
    if (!deal) return 0;

    const phaseProgress: Record<DealPhase, number> = {
      discovery: 25,
      deep_dive: 50,
      validation: 75,
      synthesis: 90,
    };

    return phaseProgress[deal.current_phase] || 0;
  }

  private async assessDealHealth(
    dealId: string,
    deal: any,
    findingStats: any
  ): Promise<'on_track' | 'at_risk' | 'delayed'> {
    // Simple health assessment based on red flags and timeline
    if (findingStats.red_flags > 10) return 'at_risk';

    if (deal.target_close_date) {
      const daysRemaining = Math.floor(
        (deal.target_close_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining < 7 && deal.current_phase !== 'synthesis') {
        return 'delayed';
      }
    }

    return 'on_track';
  }

  private async getPhaseCompletionCriteria(
    dealId: string,
    phase: DealPhase
  ): Promise<Array<{ criterion: string; satisfied: boolean; details: string }>> {
    // Mock implementation - would check actual criteria
    return [
      {
        criterion: 'All documents processed',
        satisfied: true,
        details: '245/245 documents processed',
      },
      {
        criterion: 'All workstreams completed',
        satisfied: false,
        details: '3/4 workstreams completed',
      },
    ];
  }

  private async calculateDocumentProcessingScore(dealId: string): Promise<{ score: number; status: string }> {
    const stats = await this.docRepo.getStatistics(dealId);
    const processingRate = stats.total > 0 ? (stats.by_status.processed || 0) / stats.total : 0;
    return {
      score: processingRate * 100,
      status: processingRate > 0.9 ? 'Excellent' : processingRate > 0.7 ? 'Good' : 'Needs attention',
    };
  }

  private async calculateFindingsQualityScore(dealId: string): Promise<{ score: number; status: string }> {
    const confidenceDist = await this.confidenceService.getConfidenceDistribution(dealId);
    const score = confidenceDist.avg_confidence * 100;
    return {
      score,
      status: score > 80 ? 'High quality' : score > 60 ? 'Moderate quality' : 'Low quality',
    };
  }

  private async calculatePhaseProgressScore(dealId: string): Promise<{ score: number; status: string }> {
    const progress = await this.calculateDealProgress(dealId);
    return {
      score: progress,
      status: progress > 75 ? 'On schedule' : progress > 50 ? 'Progressing' : 'Behind schedule',
    };
  }

  private async calculateRedFlagScore(dealId: string): Promise<{ score: number; status: string }> {
    const stats = await this.getBasicFindingStats(dealId);
    // Inverse score - fewer red flags = higher score
    const score = Math.max(0, 100 - stats.red_flags * 5);
    return {
      score,
      status: stats.red_flags === 0 ? 'No red flags' : stats.red_flags < 5 ? 'Minor concerns' : 'Significant concerns',
    };
  }

  private async calculateTimelineAdherenceScore(deal: any): Promise<{ score: number; status: string }> {
    if (!deal.target_close_date) {
      return { score: 100, status: 'No deadline set' };
    }

    const daysRemaining = Math.floor(
      (deal.target_close_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const progress = await this.calculateDealProgress(deal.id);

    const score = daysRemaining > 0 && progress > 50 ? 100 : 50;
    return {
      score,
      status: daysRemaining > 14 ? 'On track' : daysRemaining > 0 ? 'Tight timeline' : 'Overdue',
    };
  }

  private generateHealthRecommendations(factors: any): string[] {
    const recommendations: string[] = [];

    if (factors.docProcessingScore.score < 80) {
      recommendations.push('Accelerate document processing - consider additional resources');
    }
    if (factors.findingsQualityScore.score < 70) {
      recommendations.push('Improve finding quality - add more citations and cross-validation');
    }
    if (factors.redFlagScore.score < 70) {
      recommendations.push('Address critical red flags before proceeding to next phase');
    }
    if (factors.timelineScore.score < 80) {
      recommendations.push('Review timeline and consider phase acceleration strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Deal is progressing well - continue current approach');
    }

    return recommendations;
  }

  private async calculateProcessingVelocity(dealId: string): Promise<number> {
    // Calculate documents processed per day (last 7 days)
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM documents
       WHERE deal_id = $1 AND status = 'processed'
       AND updated_at >= NOW() - INTERVAL '7 days'`,
      [dealId]
    );

    return Math.round(parseInt(result.rows[0]?.count || '0') / 7);
  }

  private async calculateTrends(dealId: string): Promise<{
    documents_processed_trend: number[];
    findings_created_trend: number[];
    confidence_trend: number[];
  }> {
    // Mock implementation - would calculate actual daily trends
    return {
      documents_processed_trend: [10, 12, 15, 18, 20, 22, 25],
      findings_created_trend: [5, 8, 12, 15, 18, 20, 22],
      confidence_trend: [0.65, 0.68, 0.70, 0.72, 0.74, 0.76, 0.78],
    };
  }

  private formatEventTitle(actionType: string, details: any): string {
    const titleMap: Record<string, string> = {
      phase_transition: 'Phase Transition',
      document_upload: 'Document Uploaded',
      finding_created: 'New Finding Created',
      red_flag: 'Red Flag Identified',
    };

    return titleMap[actionType] || actionType.replace(/_/g, ' ');
  }

  private formatAgentName(agentId: string): string {
    const nameMap: Record<string, string> = {
      financial: 'Financial Analysis',
      commercial: 'Commercial Analysis',
      technical: 'Technical Analysis',
      operational: 'Operational Analysis',
      orchestrator: 'Orchestrator',
      ingestion: 'Document Ingestion',
    };

    return nameMap[agentId] || agentId;
  }
}
