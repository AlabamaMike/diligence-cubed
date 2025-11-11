/**
 * Approval Workflow Service
 * Manages multi-step approval processes for findings, analysis plans, and reports
 */

import { DatabaseClient } from '../database/client';
import { NotificationService } from './NotificationService';
import { AuditService } from './AuditService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ApprovalEntityType =
  | 'finding'
  | 'analysis_plan'
  | 'template_response'
  | 'phase_transition'
  | 'executive_summary'
  | 'red_flag_resolution';

export type ApprovalMode = 'sequential' | 'parallel' | 'any_one';

export interface ApprovalStep {
  step_number: number;
  approver_role?: string;
  approver_user_id?: string;
  required: boolean;
  can_delegate: boolean;
  timeout_hours?: number; // Auto-escalate after timeout
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  entity_type: ApprovalEntityType;
  description?: string;
  mode: ApprovalMode;
  steps: ApprovalStep[];
  auto_approve_conditions?: {
    confidence_threshold?: number;
    low_impact_only?: boolean;
    system_findings?: boolean;
  };
  is_system_workflow: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowInstance {
  id: string;
  deal_id: string;
  workflow_definition_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'timeout';
  current_step: number;
  initiated_by: string;
  initiated_at: Date;
  completed_at?: Date;
  metadata?: Record<string, any>;
}

export interface ApprovalAction {
  id: string;
  workflow_instance_id: string;
  step_number: number;
  approver_user_id: string;
  action: 'approved' | 'rejected' | 'delegated' | 'requested_changes';
  comments?: string;
  delegated_to?: string;
  created_at: Date;
}

export interface ApprovalRequest {
  workflow_instance_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  entity_title: string;
  step_number: number;
  approver_user_id: string;
  deadline?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
}

// ============================================================================
// SYSTEM WORKFLOW DEFINITIONS
// ============================================================================

const SYSTEM_WORKFLOWS: Omit<WorkflowDefinition, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Standard Finding Approval',
    entity_type: 'finding',
    description: 'Standard approval workflow for all findings',
    mode: 'sequential',
    steps: [
      {
        step_number: 1,
        approver_role: 'analyst',
        required: true,
        can_delegate: false,
      },
      {
        step_number: 2,
        approver_role: 'manager',
        required: true,
        can_delegate: true,
        timeout_hours: 48,
      },
      {
        step_number: 3,
        approver_role: 'partner',
        required: false,
        can_delegate: false,
        timeout_hours: 72,
      },
    ],
    auto_approve_conditions: {
      confidence_threshold: 0.95,
      low_impact_only: true,
    },
    is_system_workflow: true,
    active: true,
  },
  {
    name: 'Critical Finding Approval',
    entity_type: 'finding',
    description: 'Approval workflow for critical/high-impact findings',
    mode: 'sequential',
    steps: [
      {
        step_number: 1,
        approver_role: 'manager',
        required: true,
        can_delegate: false,
      },
      {
        step_number: 2,
        approver_role: 'partner',
        required: true,
        can_delegate: false,
        timeout_hours: 24,
      },
      {
        step_number: 3,
        approver_role: 'board',
        required: true,
        can_delegate: false,
        timeout_hours: 48,
      },
    ],
    is_system_workflow: true,
    active: true,
  },
  {
    name: 'Analysis Plan Approval',
    entity_type: 'analysis_plan',
    description: 'Approval for agent analysis plans',
    mode: 'parallel',
    steps: [
      {
        step_number: 1,
        approver_role: 'deal_lead',
        required: true,
        can_delegate: true,
        timeout_hours: 24,
      },
      {
        step_number: 1,
        approver_role: 'domain_expert',
        required: false,
        can_delegate: false,
        timeout_hours: 48,
      },
    ],
    is_system_workflow: true,
    active: true,
  },
  {
    name: 'Phase Transition Approval',
    entity_type: 'phase_transition',
    description: 'Approval required before transitioning to next deal phase',
    mode: 'sequential',
    steps: [
      {
        step_number: 1,
        approver_role: 'deal_lead',
        required: true,
        can_delegate: false,
        timeout_hours: 48,
      },
      {
        step_number: 2,
        approver_role: 'partner',
        required: true,
        can_delegate: false,
        timeout_hours: 24,
      },
    ],
    is_system_workflow: true,
    active: true,
  },
  {
    name: 'Executive Summary Approval',
    entity_type: 'executive_summary',
    description: 'Approval for executive summary before distribution',
    mode: 'any_one',
    steps: [
      {
        step_number: 1,
        approver_role: 'partner',
        required: true,
        can_delegate: false,
      },
      {
        step_number: 1,
        approver_role: 'board',
        required: true,
        can_delegate: false,
      },
    ],
    is_system_workflow: true,
    active: true,
  },
];

// ============================================================================
// APPROVAL WORKFLOW SERVICE
// ============================================================================

export class ApprovalWorkflowService extends EventEmitter {
  private notificationService: NotificationService;
  private auditService: AuditService;

  constructor(private db: DatabaseClient) {
    super();
    this.notificationService = new NotificationService(db);
    this.auditService = new AuditService(db);
    this.initializeDatabase();
  }

  /**
   * Initialize database tables
   */
  private async initializeDatabase(): Promise<void> {
    // Create workflow_definitions table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        description TEXT,
        mode VARCHAR(20) NOT NULL,
        steps JSONB NOT NULL,
        auto_approve_conditions JSONB,
        is_system_workflow BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_workflow_definitions_entity (entity_type),
        INDEX idx_workflow_definitions_active (active)
      );
    `);

    // Create workflow_instances table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        current_step INTEGER DEFAULT 0,
        initiated_by VARCHAR(100) NOT NULL,
        initiated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        metadata JSONB,
        INDEX idx_workflow_instances_deal (deal_id),
        INDEX idx_workflow_instances_entity (entity_type, entity_id),
        INDEX idx_workflow_instances_status (status)
      );
    `);

    // Create approval_actions table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS approval_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        approver_user_id VARCHAR(100) NOT NULL,
        action VARCHAR(30) NOT NULL,
        comments TEXT,
        delegated_to VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_approval_actions_instance (workflow_instance_id),
        INDEX idx_approval_actions_approver (approver_user_id)
      );
    `);

    // Create approval_requests table (active pending approvals)
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        entity_title VARCHAR(500),
        step_number INTEGER NOT NULL,
        approver_user_id VARCHAR(100) NOT NULL,
        deadline TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        INDEX idx_approval_requests_approver (approver_user_id, status),
        INDEX idx_approval_requests_instance (workflow_instance_id),
        INDEX idx_approval_requests_deadline (deadline)
      );
    `);

    logger.info('Approval workflow database initialized');
  }

  /**
   * Seed system workflow definitions
   */
  async seedSystemWorkflows(): Promise<void> {
    logger.info('Seeding system workflow definitions');

    for (const workflow of SYSTEM_WORKFLOWS) {
      const existing = await this.db.query(
        'SELECT id FROM workflow_definitions WHERE name = $1 AND is_system_workflow = true',
        [workflow.name]
      );

      if (existing.rows.length === 0) {
        await this.db.query(
          `INSERT INTO workflow_definitions
           (name, entity_type, description, mode, steps, auto_approve_conditions, is_system_workflow, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workflow.name,
            workflow.entity_type,
            workflow.description || null,
            workflow.mode,
            JSON.stringify(workflow.steps),
            workflow.auto_approve_conditions ? JSON.stringify(workflow.auto_approve_conditions) : null,
            workflow.is_system_workflow,
            workflow.active,
          ]
        );
        logger.info('Seeded workflow definition', { name: workflow.name });
      }
    }
  }

  // ==========================================================================
  // WORKFLOW INITIATION
  // ==========================================================================

  /**
   * Initiate approval workflow for an entity
   */
  async initiateWorkflow(
    dealId: string,
    entityType: ApprovalEntityType,
    entityId: string,
    entityTitle: string,
    initiatedBy: string,
    workflowDefinitionId?: string
  ): Promise<string> {
    logger.info('Initiating approval workflow', {
      dealId,
      entityType,
      entityId,
    });

    // Get workflow definition
    let workflow: WorkflowDefinition | null;

    if (workflowDefinitionId) {
      workflow = await this.getWorkflowDefinition(workflowDefinitionId);
    } else {
      // Use default workflow for entity type
      workflow = await this.getDefaultWorkflowForType(entityType);
    }

    if (!workflow) {
      throw new Error(`No workflow found for entity type: ${entityType}`);
    }

    // Check auto-approve conditions
    if (workflow.auto_approve_conditions) {
      const shouldAutoApprove = await this.checkAutoApprove(
        entityType,
        entityId,
        workflow.auto_approve_conditions
      );

      if (shouldAutoApprove) {
        logger.info('Auto-approving based on conditions', { entityId });
        return await this.autoApprove(dealId, entityType, entityId, initiatedBy);
      }
    }

    // Create workflow instance
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO workflow_instances
       (deal_id, workflow_definition_id, entity_type, entity_id, initiated_by, status)
       VALUES ($1, $2, $3, $4, $5, 'in_progress')
       RETURNING id`,
      [dealId, workflow.id, entityType, entityId, initiatedBy]
    );

    const instanceId = result.rows[0].id;

    // Create initial approval requests based on mode
    await this.createApprovalRequests(instanceId, workflow, entityTitle);

    // Audit log
    await this.auditService.log(
      dealId,
      initiatedBy,
      'workflow_initiated',
      {
        workflow_instance_id: instanceId,
        entity_type: entityType,
        entity_id: entityId,
        workflow_name: workflow.name,
      },
      {}
    );

    // Emit event
    this.emit('workflow_initiated', {
      instance_id: instanceId,
      entity_type: entityType,
      entity_id: entityId,
    });

    logger.info('Workflow initiated', { instanceId });
    return instanceId;
  }

  /**
   * Create approval requests for workflow instance
   */
  private async createApprovalRequests(
    instanceId: string,
    workflow: WorkflowDefinition,
    entityTitle: string
  ): Promise<void> {
    const instance = await this.getWorkflowInstance(instanceId);
    if (!instance) return;

    let stepsToCreate: ApprovalStep[];

    if (workflow.mode === 'sequential') {
      // Only create requests for first step
      stepsToCreate = workflow.steps.filter((s) => s.step_number === 1);
    } else {
      // Create all requests for parallel/any_one modes
      stepsToCreate = workflow.steps;
    }

    for (const step of stepsToCreate) {
      // Get users for the approver role
      const approvers = step.approver_user_id
        ? [step.approver_user_id]
        : await this.getUsersForRole(instance.deal_id, step.approver_role!);

      for (const approverId of approvers) {
        const deadline = step.timeout_hours
          ? new Date(Date.now() + step.timeout_hours * 60 * 60 * 1000)
          : null;

        await this.db.query(
          `INSERT INTO approval_requests
           (workflow_instance_id, entity_type, entity_id, entity_title, step_number, approver_user_id, deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            instanceId,
            instance.entity_type,
            instance.entity_id,
            entityTitle,
            step.step_number,
            approverId,
            deadline,
          ]
        );

        // Send notification
        await this.notificationService.create(
          instance.deal_id,
          approverId,
          'approval_requested',
          `Approval needed: ${entityTitle}`,
          {
            workflow_instance_id: instanceId,
            entity_type: instance.entity_type,
            entity_id: instance.entity_id,
            deadline: deadline?.toISOString(),
          },
          'high'
        );
      }
    }
  }

  /**
   * Get users with specific role for a deal
   */
  private async getUsersForRole(dealId: string, role: string): Promise<string[]> {
    const result = await this.db.query<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM deal_access WHERE deal_id = $1 AND role = $2',
      [dealId, role]
    );

    return result.rows.map((r) => r.user_id);
  }

  // ==========================================================================
  // APPROVAL ACTIONS
  // ==========================================================================

  /**
   * Approve a pending request
   */
  async approve(
    workflowInstanceId: string,
    approverId: string,
    comments?: string
  ): Promise<void> {
    logger.info('Processing approval', { workflowInstanceId, approverId });

    const instance = await this.getWorkflowInstance(workflowInstanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${workflowInstanceId}`);
    }

    const workflow = await this.getWorkflowDefinition(instance.workflow_definition_id);
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${instance.workflow_definition_id}`);
    }

    // Find pending request for this approver
    const requestResult = await this.db.query<{ id: string; step_number: number }>(
      `SELECT id, step_number FROM approval_requests
       WHERE workflow_instance_id = $1 AND approver_user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [workflowInstanceId, approverId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('No pending approval request found for this user');
    }

    const request = requestResult.rows[0];

    // Record approval action
    await this.db.query(
      `INSERT INTO approval_actions
       (workflow_instance_id, step_number, approver_user_id, action, comments)
       VALUES ($1, $2, $3, 'approved', $4)`,
      [workflowInstanceId, request.step_number, approverId, comments || null]
    );

    // Mark request as approved
    await this.db.query(
      'UPDATE approval_requests SET status = \'approved\' WHERE id = $1',
      [request.id]
    );

    // Check if step is complete
    await this.checkStepCompletion(workflowInstanceId, workflow, request.step_number);

    // Audit log
    await this.auditService.log(
      instance.deal_id,
      approverId,
      'approval_granted',
      {
        workflow_instance_id: workflowInstanceId,
        entity_type: instance.entity_type,
        entity_id: instance.entity_id,
        comments,
      },
      {}
    );

    this.emit('approval_granted', {
      instance_id: workflowInstanceId,
      approver_id: approverId,
      step: request.step_number,
    });
  }

  /**
   * Reject a pending request
   */
  async reject(
    workflowInstanceId: string,
    approverId: string,
    reason: string
  ): Promise<void> {
    logger.info('Processing rejection', { workflowInstanceId, approverId });

    const instance = await this.getWorkflowInstance(workflowInstanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${workflowInstanceId}`);
    }

    // Find pending request
    const requestResult = await this.db.query<{ id: string; step_number: number }>(
      `SELECT id, step_number FROM approval_requests
       WHERE workflow_instance_id = $1 AND approver_user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [workflowInstanceId, approverId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('No pending approval request found for this user');
    }

    const request = requestResult.rows[0];

    // Record rejection action
    await this.db.query(
      `INSERT INTO approval_actions
       (workflow_instance_id, step_number, approver_user_id, action, comments)
       VALUES ($1, $2, $3, 'rejected', $4)`,
      [workflowInstanceId, request.step_number, approverId, reason]
    );

    // Mark request as rejected
    await this.db.query(
      'UPDATE approval_requests SET status = \'rejected\' WHERE id = $1',
      [request.id]
    );

    // Reject entire workflow
    await this.db.query(
      'UPDATE workflow_instances SET status = \'rejected\', completed_at = NOW() WHERE id = $1',
      [workflowInstanceId]
    );

    // Cancel all other pending requests
    await this.db.query(
      'DELETE FROM approval_requests WHERE workflow_instance_id = $1 AND status = \'pending\'',
      [workflowInstanceId]
    );

    // Notify initiator
    await this.notificationService.create(
      instance.deal_id,
      instance.initiated_by,
      'approval_rejected',
      `Approval rejected by ${approverId}`,
      {
        workflow_instance_id: workflowInstanceId,
        entity_type: instance.entity_type,
        entity_id: instance.entity_id,
        reason,
      },
      'high'
    );

    // Audit log
    await this.auditService.log(
      instance.deal_id,
      approverId,
      'approval_rejected',
      {
        workflow_instance_id: workflowInstanceId,
        entity_type: instance.entity_type,
        entity_id: instance.entity_id,
        reason,
      },
      {}
    );

    this.emit('approval_rejected', {
      instance_id: workflowInstanceId,
      approver_id: approverId,
      reason,
    });
  }

  /**
   * Delegate approval to another user
   */
  async delegate(
    workflowInstanceId: string,
    approverId: string,
    delegateToUserId: string,
    reason?: string
  ): Promise<void> {
    logger.info('Delegating approval', {
      workflowInstanceId,
      from: approverId,
      to: delegateToUserId,
    });

    // Find pending request
    const requestResult = await this.db.query<ApprovalRequest & { step_number: number }>(
      `SELECT * FROM approval_requests
       WHERE workflow_instance_id = $1 AND approver_user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [workflowInstanceId, approverId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('No pending approval request found');
    }

    const request = requestResult.rows[0];

    // Check if delegation is allowed
    const workflow = await this.getWorkflowDefinition(
      (await this.getWorkflowInstance(workflowInstanceId))!.workflow_definition_id
    );

    const step = workflow?.steps.find((s) => s.step_number === request.step_number);
    if (!step?.can_delegate) {
      throw new Error('Delegation not allowed for this approval step');
    }

    // Record delegation action
    await this.db.query(
      `INSERT INTO approval_actions
       (workflow_instance_id, step_number, approver_user_id, action, delegated_to, comments)
       VALUES ($1, $2, $3, 'delegated', $4, $5)`,
      [workflowInstanceId, request.step_number, approverId, delegateToUserId, reason || null]
    );

    // Update approval request to new approver
    await this.db.query(
      'UPDATE approval_requests SET approver_user_id = $1 WHERE id = $2',
      [delegateToUserId, request.workflow_instance_id]
    );

    // Notify delegate
    const instance = await this.getWorkflowInstance(workflowInstanceId);
    if (instance) {
      await this.notificationService.create(
        instance.deal_id,
        delegateToUserId,
        'approval_delegated',
        `Approval delegated from ${approverId}: ${request.entity_title}`,
        {
          workflow_instance_id: workflowInstanceId,
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          delegated_by: approverId,
        },
        'high'
      );
    }
  }

  /**
   * Request changes before approval
   */
  async requestChanges(
    workflowInstanceId: string,
    approverId: string,
    changes: string
  ): Promise<void> {
    logger.info('Requesting changes', { workflowInstanceId, approverId });

    const instance = await this.getWorkflowInstance(workflowInstanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${workflowInstanceId}`);
    }

    // Find pending request
    const requestResult = await this.db.query<{ id: string; step_number: number }>(
      `SELECT id, step_number FROM approval_requests
       WHERE workflow_instance_id = $1 AND approver_user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [workflowInstanceId, approverId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('No pending approval request found');
    }

    const request = requestResult.rows[0];

    // Record action
    await this.db.query(
      `INSERT INTO approval_actions
       (workflow_instance_id, step_number, approver_user_id, action, comments)
       VALUES ($1, $2, $3, 'requested_changes', $4)`,
      [workflowInstanceId, request.step_number, approverId, changes]
    );

    // Notify initiator
    await this.notificationService.create(
      instance.deal_id,
      instance.initiated_by,
      'changes_requested',
      `Changes requested by ${approverId}`,
      {
        workflow_instance_id: workflowInstanceId,
        entity_type: instance.entity_type,
        entity_id: instance.entity_id,
        changes,
      },
      'high'
    );
  }

  // ==========================================================================
  // WORKFLOW PROGRESSION
  // ==========================================================================

  /**
   * Check if current step is complete and advance if needed
   */
  private async checkStepCompletion(
    instanceId: string,
    workflow: WorkflowDefinition,
    stepNumber: number
  ): Promise<void> {
    const pendingCount = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM approval_requests
       WHERE workflow_instance_id = $1 AND step_number = $2 AND status = 'pending'`,
      [instanceId, stepNumber]
    );

    const pending = parseInt(pendingCount.rows[0]?.count || '0');

    if (pending === 0) {
      // Step complete - check mode
      if (workflow.mode === 'sequential') {
        await this.advanceToNextStep(instanceId, workflow, stepNumber);
      } else if (workflow.mode === 'any_one') {
        await this.completeWorkflow(instanceId);
      } else if (workflow.mode === 'parallel') {
        // Check if all steps complete
        const allStepsComplete = await this.areAllStepsComplete(instanceId);
        if (allStepsComplete) {
          await this.completeWorkflow(instanceId);
        }
      }
    }
  }

  /**
   * Advance to next step in sequential workflow
   */
  private async advanceToNextStep(
    instanceId: string,
    workflow: WorkflowDefinition,
    currentStep: number
  ): Promise<void> {
    const nextStep = currentStep + 1;
    const nextStepDef = workflow.steps.filter((s) => s.step_number === nextStep);

    if (nextStepDef.length === 0) {
      // No more steps - complete workflow
      await this.completeWorkflow(instanceId);
      return;
    }

    // Update current step
    await this.db.query(
      'UPDATE workflow_instances SET current_step = $1 WHERE id = $2',
      [nextStep, instanceId]
    );

    // Create next approval requests
    const instance = await this.getWorkflowInstance(instanceId);
    if (instance) {
      await this.createApprovalRequests(instanceId, workflow, 'Entity');
    }
  }

  /**
   * Check if all steps are complete
   */
  private async areAllStepsComplete(instanceId: string): Promise<boolean> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM approval_requests
       WHERE workflow_instance_id = $1 AND status = 'pending'`,
      [instanceId]
    );

    return parseInt(result.rows[0]?.count || '0') === 0;
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(instanceId: string): Promise<void> {
    logger.info('Completing workflow', { instanceId });

    await this.db.query(
      'UPDATE workflow_instances SET status = \'approved\', completed_at = NOW() WHERE id = $1',
      [instanceId]
    );

    const instance = await this.getWorkflowInstance(instanceId);
    if (instance) {
      // Notify initiator
      await this.notificationService.create(
        instance.deal_id,
        instance.initiated_by,
        'workflow_approved',
        'Approval workflow completed successfully',
        {
          workflow_instance_id: instanceId,
          entity_type: instance.entity_type,
          entity_id: instance.entity_id,
        },
        'normal'
      );

      // Audit log
      await this.auditService.log(
        instance.deal_id,
        'system',
        'workflow_completed',
        {
          workflow_instance_id: instanceId,
          entity_type: instance.entity_type,
          entity_id: instance.entity_id,
        },
        {}
      );

      this.emit('workflow_completed', {
        instance_id: instanceId,
        entity_type: instance.entity_type,
        entity_id: instance.entity_id,
      });
    }
  }

  /**
   * Auto-approve entity
   */
  private async autoApprove(
    dealId: string,
    entityType: ApprovalEntityType,
    entityId: string,
    initiatedBy: string
  ): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO workflow_instances
       (deal_id, workflow_definition_id, entity_type, entity_id, initiated_by, status, completed_at)
       VALUES ($1, NULL, $2, $3, $4, 'approved', NOW())
       RETURNING id`,
      [dealId, entityType, entityId, initiatedBy]
    );

    const instanceId = result.rows[0].id;

    await this.auditService.log(
      dealId,
      'system',
      'auto_approved',
      {
        workflow_instance_id: instanceId,
        entity_type: entityType,
        entity_id: entityId,
      },
      {}
    );

    return instanceId;
  }

  // ==========================================================================
  // TIMEOUT & ESCALATION
  // ==========================================================================

  /**
   * Process timeout approvals and escalate
   */
  async processTimeouts(): Promise<void> {
    logger.info('Processing approval timeouts');

    const timeoutResult = await this.db.query<ApprovalRequest>(
      `SELECT * FROM approval_requests
       WHERE status = 'pending' AND deadline IS NOT NULL AND deadline < NOW()`
    );

    for (const request of timeoutResult.rows) {
      logger.info('Approval request timed out', {
        requestId: request.id,
        approverId: request.approver_user_id,
      });

      // Mark as timeout
      await this.db.query(
        'UPDATE approval_requests SET status = \'timeout\' WHERE id = $1',
        [request.id]
      );

      // Escalate to next level or workflow owner
      const instance = await this.getWorkflowInstance(request.workflow_instance_id);
      if (instance) {
        await this.notificationService.create(
          instance.deal_id,
          instance.initiated_by,
          'approval_timeout',
          `Approval timeout: ${request.entity_title}`,
          {
            workflow_instance_id: request.workflow_instance_id,
            approver: request.approver_user_id,
          },
          'critical'
        );
      }
    }
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  async getWorkflowDefinition(id: string): Promise<WorkflowDefinition | null> {
    const result = await this.db.query<WorkflowDefinition>(
      'SELECT * FROM workflow_definitions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      auto_approve_conditions:
        row.auto_approve_conditions && typeof row.auto_approve_conditions === 'string'
          ? JSON.parse(row.auto_approve_conditions)
          : row.auto_approve_conditions,
    };
  }

  async getDefaultWorkflowForType(
    entityType: ApprovalEntityType
  ): Promise<WorkflowDefinition | null> {
    const result = await this.db.query<WorkflowDefinition>(
      `SELECT * FROM workflow_definitions
       WHERE entity_type = $1 AND active = true AND is_system_workflow = true
       ORDER BY created_at DESC LIMIT 1`,
      [entityType]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      auto_approve_conditions:
        row.auto_approve_conditions && typeof row.auto_approve_conditions === 'string'
          ? JSON.parse(row.auto_approve_conditions)
          : row.auto_approve_conditions,
    };
  }

  async getWorkflowInstance(id: string): Promise<WorkflowInstance | null> {
    const result = await this.db.query<WorkflowInstance>(
      'SELECT * FROM workflow_instances WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      metadata: row.metadata && typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    };
  }

  async getPendingApprovalsForUser(userId: string): Promise<ApprovalRequest[]> {
    const result = await this.db.query<ApprovalRequest>(
      `SELECT * FROM approval_requests
       WHERE approver_user_id = $1 AND status = 'pending'
       ORDER BY deadline ASC NULLS LAST, created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getWorkflowHistory(entityType: ApprovalEntityType, entityId: string): Promise<WorkflowInstance[]> {
    const result = await this.db.query<WorkflowInstance>(
      `SELECT * FROM workflow_instances
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY initiated_at DESC`,
      [entityType, entityId]
    );

    return result.rows.map((row) => ({
      ...row,
      metadata: row.metadata && typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    }));
  }

  // ==========================================================================
  // AUTO-APPROVE CONDITIONS
  // ==========================================================================

  private async checkAutoApprove(
    entityType: ApprovalEntityType,
    entityId: string,
    conditions: NonNullable<WorkflowDefinition['auto_approve_conditions']>
  ): Promise<boolean> {
    if (entityType === 'finding') {
      const finding = await this.db.query<{
        confidence_score: number;
        impact_level: string;
      }>(
        'SELECT confidence_score, impact_level FROM findings WHERE id = $1',
        [entityId]
      );

      if (finding.rows.length === 0) return false;

      const f = finding.rows[0];

      if (conditions.confidence_threshold && f.confidence_score < conditions.confidence_threshold) {
        return false;
      }

      if (
        conditions.low_impact_only &&
        !['low', 'medium'].includes(f.impact_level)
      ) {
        return false;
      }

      return true;
    }

    return false;
  }
}
