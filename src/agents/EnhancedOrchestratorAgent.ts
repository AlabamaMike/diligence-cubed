/**
 * Enhanced Orchestrator Agent
 * Coordinates cross-functional workstreams, manages phase transitions,
 * and handles inter-agent communication for MBB-standard due diligence
 */

import { DatabaseClient } from '../database/client';
import { DealRepository } from '../database/repositories/DealRepository';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { ConfigService } from '../services/ConfigService';
import { AuditService } from '../services/AuditService';
import { NotificationService } from '../services/NotificationService';
import { Deal, DealPhase, Finding } from '../types/database';
import { logger } from '../utils/logger';

export interface PhaseTransitionCriteria {
  min_documents_processed?: number;
  classification_complete?: boolean;
  min_findings_per_workstream?: number;
  all_workstreams_progress?: number;
  findings_validation_rate?: number;
  red_flags_reviewed?: boolean;
  report_generated?: boolean;
  executive_summary_approved?: boolean;
}

export interface WorkstreamTask {
  workstream_id: string;
  workstream_name: string;
  agent_type: string;
  task_description: string;
  priority: number;
  dependencies: string[];
  estimated_duration_hours?: number;
}

export interface DiligenceAnalysisPlan {
  deal_id: string;
  current_phase: DealPhase;
  next_phase?: DealPhase;
  workstream_tasks: WorkstreamTask[];
  parallel_tasks: string[][];
  critical_path: string[];
  estimated_completion_date: Date;
}

export class EnhancedOrchestratorAgent {
  private dealRepo: DealRepository;
  private findingRepo: FindingRepository;
  private configService: ConfigService;
  private auditService: AuditService;
  private notificationService: NotificationService;

  constructor(private db: DatabaseClient) {
    this.dealRepo = new DealRepository(db);
    this.findingRepo = new FindingRepository(db);
    this.configService = new ConfigService(db);
    this.auditService = new AuditService(db);
    this.notificationService = new NotificationService(db);
  }

  // ============================================================================
  // DEAL INITIALIZATION
  // ============================================================================

  /**
   * Initialize a new deal with complete setup
   */
  async initializeDeal(input: {
    name: string;
    target_company: string;
    deal_type: 'acquisition' | 'investment' | 'merger' | 'other';
    deal_size_usd?: number;
    target_industry?: string;
    target_region?: string;
    created_by: string;
    target_close_date?: Date;
  }): Promise<{
    deal: Deal;
    phases: any[];
    workstreams: any[];
  }> {
    logger.info('Initializing new deal', { name: input.name, targetCompany: input.target_company });

    // Generate encryption key for this deal
    const encryptionKeyId = this.generateEncryptionKeyId();

    // Create deal
    const deal = await this.dealRepo.create({
      ...input,
      encryption_key_id: encryptionKeyId,
    });

    // Initialize configuration
    await this.configService.initializeDealConfig(deal.id);

    // Create phases
    const phases = await this.createPhases(deal.id);

    // Create initial workstreams
    const workstreams = await this.createInitialWorkstreams(deal.id, phases[0].id);

    // Log audit trail
    await this.auditService.log({
      deal_id: deal.id,
      user_id: input.created_by,
      action_type: 'deal_initialized',
      entity_type: 'deal',
      entity_id: deal.id,
      action_details: {
        name: input.name,
        target_company: input.target_company,
        deal_type: input.deal_type,
      },
    });

    logger.info('Deal initialized successfully', { dealId: deal.id });

    return { deal, phases, workstreams };
  }

  /**
   * Create phases for a deal
   * @private
   */
  private async createPhases(dealId: string): Promise<any[]> {
    const phases = [
      { name: 'discovery', order: 1 },
      { name: 'deep_dive', order: 2 },
      { name: 'validation', order: 3 },
      { name: 'synthesis', order: 4 },
    ];

    const createdPhases = [];
    for (const phase of phases) {
      const query = `
        INSERT INTO deal_phases (deal_id, phase_name, phase_order, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const status = phase.order === 1 ? 'in_progress' : 'pending';
      const result = await this.db.query(query, [dealId, phase.name, phase.order, status]);
      createdPhases.push(result.rows[0]);
    }

    return createdPhases;
  }

  /**
   * Create initial workstreams
   * @private
   */
  private async createInitialWorkstreams(dealId: string, phaseId: string): Promise<any[]> {
    const workstreams = [
      { name: 'Ingestion', agent_type: 'ingestion', priority: 1 },
      { name: 'Financial Analysis', agent_type: 'financial', priority: 2 },
      { name: 'Commercial Analysis', agent_type: 'commercial', priority: 2 },
      { name: 'Technical Analysis', agent_type: 'technical', priority: 2 },
      { name: 'Operational Analysis', agent_type: 'operational', priority: 2 },
    ];

    const createdWorkstreams = [];
    for (const workstream of workstreams) {
      const query = `
        INSERT INTO workstreams (deal_id, phase_id, name, agent_type, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const status = workstream.priority === 1 ? 'in_progress' : 'pending';
      const result = await this.db.query(query, [
        dealId,
        phaseId,
        workstream.name,
        workstream.agent_type,
        status,
      ]);
      createdWorkstreams.push(result.rows[0]);
    }

    return createdWorkstreams;
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  /**
   * Check if phase transition criteria are met
   */
  async evaluatePhaseTransition(dealId: string): Promise<{
    canTransition: boolean;
    currentPhase: DealPhase;
    nextPhase?: DealPhase;
    missingCriteria: string[];
    readyWorkstreams: number;
    totalWorkstreams: number;
  }> {
    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    const config = await this.configService.getDealConfig(dealId);
    if (!config) {
      throw new Error(`Deal configuration not found: ${dealId}`);
    }

    const currentPhase = deal.current_phase;
    const phaseDefinition = config.phase_definitions[currentPhase];

    if (!phaseDefinition) {
      logger.warn('No phase definition found', { dealId, currentPhase });
      return {
        canTransition: false,
        currentPhase,
        missingCriteria: ['Phase definition not found'],
        readyWorkstreams: 0,
        totalWorkstreams: 0,
      };
    }

    const criteria: PhaseTransitionCriteria = phaseDefinition.transition_criteria || {};
    const missingCriteria: string[] = [];

    // Check document processing
    if (criteria.min_documents_processed) {
      const docStats = await this.db.query(
        `SELECT COUNT(*) as count FROM documents WHERE deal_id = $1 AND processing_status = 'indexed'`,
        [dealId]
      );
      const processedCount = parseInt(docStats.rows[0]?.count || '0');
      if (processedCount < criteria.min_documents_processed) {
        missingCriteria.push(
          `Only ${processedCount}/${criteria.min_documents_processed} documents processed`
        );
      }
    }

    // Check workstream progress
    const workstreamStats = await this.db.query(
      `SELECT
        COUNT(*) as total,
        AVG(progress_percentage) as avg_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM workstreams WHERE deal_id = $1`,
      [dealId]
    );

    const totalWorkstreams = parseInt(workstreamStats.rows[0]?.total || '0');
    const avgProgress = parseFloat(workstreamStats.rows[0]?.avg_progress || '0');
    const completedWorkstreams = parseInt(workstreamStats.rows[0]?.completed || '0');

    if (criteria.all_workstreams_progress && avgProgress < criteria.all_workstreams_progress) {
      missingCriteria.push(
        `Workstream progress at ${avgProgress.toFixed(1)}%, need ${criteria.all_workstreams_progress}%`
      );
    }

    // Check findings validation
    if (criteria.findings_validation_rate) {
      const findingStats = await this.findingRepo.getStatistics(dealId);
      const validationRate =
        findingStats.totalCount > 0
          ? findingStats.acceptedCount / findingStats.totalCount
          : 0;

      if (validationRate < criteria.findings_validation_rate) {
        missingCriteria.push(
          `Findings validation rate at ${(validationRate * 100).toFixed(1)}%, need ${criteria.findings_validation_rate * 100}%`
        );
      }
    }

    // Check red flags reviewed
    if (criteria.red_flags_reviewed) {
      const redFlags = await this.findingRepo.getRedFlags(dealId);
      const unreviewed = redFlags.filter((f) => f.validation_status === 'pending');
      if (unreviewed.length > 0) {
        missingCriteria.push(`${unreviewed.length} red flags pending review`);
      }
    }

    const canTransition = missingCriteria.length === 0;
    const nextPhase = canTransition ? this.getNextPhase(currentPhase) : undefined;

    return {
      canTransition,
      currentPhase,
      nextPhase,
      missingCriteria,
      readyWorkstreams: completedWorkstreams,
      totalWorkstreams,
    };
  }

  /**
   * Transition to next phase
   */
  async transitionPhase(
    dealId: string,
    userId: string,
    forceTransition = false
  ): Promise<{
    success: boolean;
    previousPhase: DealPhase;
    newPhase?: DealPhase;
    message: string;
  }> {
    const evaluation = await this.evaluatePhaseTransition(dealId);

    if (!forceTransition && !evaluation.canTransition) {
      return {
        success: false,
        previousPhase: evaluation.currentPhase,
        message: `Cannot transition: ${evaluation.missingCriteria.join(', ')}`,
      };
    }

    if (!evaluation.nextPhase) {
      return {
        success: false,
        previousPhase: evaluation.currentPhase,
        message: 'No next phase available',
      };
    }

    // Update deal phase
    await this.dealRepo.updatePhase(dealId, evaluation.nextPhase);

    // Update phase records
    await this.db.query(
      `UPDATE deal_phases SET status = 'completed', completed_at = NOW()
       WHERE deal_id = $1 AND phase_name = $2`,
      [dealId, evaluation.currentPhase]
    );

    await this.db.query(
      `UPDATE deal_phases SET status = 'in_progress', started_at = NOW()
       WHERE deal_id = $1 AND phase_name = $2`,
      [dealId, evaluation.nextPhase]
    );

    // Log transition
    await this.auditService.logPhaseTransition(
      dealId,
      userId,
      undefined,
      evaluation.currentPhase,
      evaluation.nextPhase
    );

    // Notify stakeholders
    const userIds = await this.getStakeholderIds(dealId);
    await this.notificationService.notifyPhaseComplete(
      dealId,
      userIds,
      evaluation.currentPhase
    );

    logger.info('Phase transition completed', {
      dealId,
      from: evaluation.currentPhase,
      to: evaluation.nextPhase,
    });

    return {
      success: true,
      previousPhase: evaluation.currentPhase,
      newPhase: evaluation.nextPhase,
      message: `Successfully transitioned from ${evaluation.currentPhase} to ${evaluation.nextPhase}`,
    };
  }

  /**
   * Get next phase in sequence
   * @private
   */
  private getNextPhase(currentPhase: DealPhase): DealPhase | undefined {
    const phaseSequence: DealPhase[] = ['discovery', 'deep_dive', 'validation', 'synthesis', 'completed'];
    const currentIndex = phaseSequence.indexOf(currentPhase);

    if (currentIndex === -1 || currentIndex === phaseSequence.length - 1) {
      return undefined;
    }

    return phaseSequence[currentIndex + 1];
  }

  // ============================================================================
  // ANALYSIS PLANNING
  // ============================================================================

  /**
   * Generate comprehensive analysis plan for current phase
   */
  async generateAnalysisPlan(dealId: string): Promise<DiligenceAnalysisPlan> {
    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Get active workstreams
    const workstreamsQuery = await this.db.query(
      `SELECT * FROM workstreams WHERE deal_id = $1 AND status IN ('pending', 'in_progress')`,
      [dealId]
    );

    const workstreams = workstreamsQuery.rows;

    // Create tasks for each workstream
    const workstreamTasks: WorkstreamTask[] = workstreams.map((w, index) => ({
      workstream_id: w.id,
      workstream_name: w.name,
      agent_type: w.agent_type,
      task_description: this.getWorkstreamTaskDescription(w.agent_type, deal.current_phase),
      priority: w.agent_type === 'ingestion' ? 1 : 2,
      dependencies: w.agent_type === 'ingestion' ? [] : [workstreams[0].id],
      estimated_duration_hours: this.estimateTaskDuration(w.agent_type, deal.current_phase),
    }));

    // Identify parallel tasks
    const parallelTasks = this.identifyParallelTasks(workstreamTasks);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(workstreamTasks);

    // Estimate completion
    const estimatedCompletionDate = this.estimateCompletion(workstreamTasks);

    return {
      deal_id: dealId,
      current_phase: deal.current_phase,
      next_phase: this.getNextPhase(deal.current_phase),
      workstream_tasks: workstreamTasks,
      parallel_tasks: parallelTasks,
      critical_path: criticalPath,
      estimated_completion_date: estimatedCompletionDate,
    };
  }

  /**
   * Get task description for workstream
   * @private
   */
  private getWorkstreamTaskDescription(agentType: string, phase: DealPhase): string {
    const descriptions: Record<string, Record<DealPhase, string>> = {
      ingestion: {
        discovery: 'Process and classify uploaded documents',
        deep_dive: 'Handle incremental document updates',
        validation: 'Verify document completeness',
        synthesis: 'Prepare final document inventory',
        completed: 'Archive documents',
      },
      financial: {
        discovery: 'Initial financial statement review',
        deep_dive: 'Quality of Earnings analysis, working capital normalization',
        validation: 'Cross-validate financial findings',
        synthesis: 'Prepare financial summary',
        completed: 'Finalize financial analysis',
      },
      commercial: {
        discovery: 'Market overview and competitive landscape',
        deep_dive: 'Detailed market sizing, customer analysis, pricing power assessment',
        validation: 'Validate market assumptions',
        synthesis: 'Prepare commercial summary',
        completed: 'Finalize commercial analysis',
      },
      technical: {
        discovery: 'Technology stack overview',
        deep_dive: 'Architecture review, technical debt analysis, security assessment',
        validation: 'Validate technical findings',
        synthesis: 'Prepare technical summary',
        completed: 'Finalize technical analysis',
      },
      operational: {
        discovery: 'Organization structure overview',
        deep_dive: 'Org effectiveness, supply chain analysis, operational KPIs',
        validation: 'Validate operational findings',
        synthesis: 'Prepare operational summary',
        completed: 'Finalize operational analysis',
      },
    };

    return descriptions[agentType]?.[phase] || 'Execute workstream tasks';
  }

  /**
   * Estimate task duration in hours
   * @private
   */
  private estimateTaskDuration(agentType: string, phase: DealPhase): number {
    // Simplified estimation logic
    const baseHours: Record<string, number> = {
      ingestion: 8,
      financial: 24,
      commercial: 20,
      technical: 16,
      operational: 16,
    };

    const phaseMultiplier: Record<DealPhase, number> = {
      discovery: 0.5,
      deep_dive: 1.5,
      validation: 0.7,
      synthesis: 0.5,
      completed: 0.2,
    };

    return (baseHours[agentType] || 12) * (phaseMultiplier[phase] || 1);
  }

  /**
   * Identify tasks that can run in parallel
   * @private
   */
  private identifyParallelTasks(tasks: WorkstreamTask[]): string[][] {
    // Group tasks by priority and dependencies
    const tasksByPriority = tasks.reduce((acc, task) => {
      if (!acc[task.priority]) acc[task.priority] = [];
      acc[task.priority].push(task.workstream_id);
      return acc;
    }, {} as Record<number, string[]>);

    return Object.values(tasksByPriority);
  }

  /**
   * Calculate critical path
   * @private
   */
  private calculateCriticalPath(tasks: WorkstreamTask[]): string[] {
    // Simplified critical path: longest duration chain
    return tasks
      .sort((a, b) => (b.estimated_duration_hours || 0) - (a.estimated_duration_hours || 0))
      .slice(0, 3)
      .map((t) => t.workstream_id);
  }

  /**
   * Estimate completion date
   * @private
   */
  private estimateCompletion(tasks: WorkstreamTask[]): Date {
    const totalHours = tasks.reduce((sum, task) => sum + (task.estimated_duration_hours || 0), 0);
    const parallelEfficiency = 0.6; // Assume 60% efficiency for parallel execution
    const effectiveHours = totalHours * parallelEfficiency;
    const workingHoursPerDay = 8;
    const days = Math.ceil(effectiveHours / workingHoursPerDay);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + days);
    return completionDate;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Generate encryption key ID for deal isolation
   * @private
   */
  private generateEncryptionKeyId(): string {
    return `enc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get stakeholder user IDs for a deal
   * @private
   */
  private async getStakeholderIds(dealId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT user_id FROM deal_access WHERE deal_id = $1`,
      [dealId]
    );
    return result.rows.map((r) => r.user_id);
  }
}
