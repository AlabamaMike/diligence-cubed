/**
 * Inter-Agent Communication Service
 * Enables message passing, dependency management, and collaborative workflows
 */

import { DatabaseClient } from '../database/client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AgentMessageType =
  | 'request_analysis'
  | 'provide_context'
  | 'validate_finding'
  | 'cross_reference'
  | 'dependency_update'
  | 'task_complete'
  | 'escalation';

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';

export type MessageStatus = 'pending' | 'delivered' | 'acknowledged' | 'processed' | 'failed';

export interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  deal_id: string;
  message_type: AgentMessageType;
  priority: MessagePriority;
  subject: string;
  payload: Record<string, any>;
  status: MessageStatus;
  created_at: Date;
  delivered_at?: Date;
  processed_at?: Date;
  response?: Record<string, any>;
  correlation_id?: string; // For tracking request-response chains
}

export interface AgentDependency {
  id: string;
  deal_id: string;
  source_agent: string;
  target_agent: string;
  dependency_type: 'requires_input' | 'validates' | 'extends' | 'references';
  source_entity_type: 'finding' | 'analysis' | 'document';
  source_entity_id: string;
  target_entity_type?: 'finding' | 'analysis' | 'document';
  target_entity_id?: string;
  status: 'pending' | 'satisfied' | 'blocked' | 'cancelled';
  resolution_data?: Record<string, any>;
  created_at: Date;
  resolved_at?: Date;
}

export interface CollaborativeTask {
  id: string;
  deal_id: string;
  task_name: string;
  description: string;
  orchestrator_agent: string;
  participating_agents: string[];
  dependencies: Array<{
    agent: string;
    depends_on: string[];
  }>;
  status: 'initialized' | 'in_progress' | 'completed' | 'failed';
  progress: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
  results: Record<string, any>;
  created_at: Date;
  completed_at?: Date;
}

export interface MessageFilter {
  deal_id?: string;
  from_agent?: string;
  to_agent?: string;
  message_type?: AgentMessageType;
  status?: MessageStatus;
  priority?: MessagePriority;
  since?: Date;
}

// ============================================================================
// INTER-AGENT COMMUNICATION SERVICE
// ============================================================================

export class InterAgentCommunicationService extends EventEmitter {
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private activeTasks: Map<string, CollaborativeTask> = new Map();

  constructor(private db: DatabaseClient) {
    super();
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for inter-agent communication
   */
  private async initializeDatabase(): Promise<void> {
    // Create agent_messages table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_agent VARCHAR(100) NOT NULL,
        to_agent VARCHAR(100) NOT NULL,
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        message_type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        subject TEXT NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        delivered_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        response JSONB,
        correlation_id UUID,
        INDEX idx_agent_messages_deal (deal_id),
        INDEX idx_agent_messages_to (to_agent, status),
        INDEX idx_agent_messages_correlation (correlation_id)
      );
    `);

    // Create agent_dependencies table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS agent_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        source_agent VARCHAR(100) NOT NULL,
        target_agent VARCHAR(100) NOT NULL,
        dependency_type VARCHAR(50) NOT NULL,
        source_entity_type VARCHAR(50) NOT NULL,
        source_entity_id UUID NOT NULL,
        target_entity_type VARCHAR(50),
        target_entity_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        resolution_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        INDEX idx_agent_dependencies_deal (deal_id),
        INDEX idx_agent_dependencies_target (target_agent, status),
        INDEX idx_agent_dependencies_source (source_entity_type, source_entity_id)
      );
    `);

    // Create collaborative_tasks table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS collaborative_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        task_name VARCHAR(255) NOT NULL,
        description TEXT,
        orchestrator_agent VARCHAR(100) NOT NULL,
        participating_agents JSONB NOT NULL,
        dependencies JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'initialized',
        progress JSONB NOT NULL DEFAULT '{}',
        results JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        INDEX idx_collaborative_tasks_deal (deal_id),
        INDEX idx_collaborative_tasks_status (status)
      );
    `);

    logger.info('Inter-agent communication database initialized');
  }

  // ==========================================================================
  // MESSAGE PASSING
  // ==========================================================================

  /**
   * Send message from one agent to another
   */
  async sendMessage(
    fromAgent: string,
    toAgent: string,
    dealId: string,
    messageType: AgentMessageType,
    subject: string,
    payload: Record<string, any>,
    priority: MessagePriority = 'normal',
    correlationId?: string
  ): Promise<string> {
    logger.info('Sending inter-agent message', {
      fromAgent,
      toAgent,
      messageType,
      priority,
    });

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO agent_messages
       (from_agent, to_agent, deal_id, message_type, priority, subject, payload, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        fromAgent,
        toAgent,
        dealId,
        messageType,
        priority,
        subject,
        JSON.stringify(payload),
        correlationId || null,
      ]
    );

    const messageId = result.rows[0].id;

    // Add to in-memory queue for fast delivery
    if (!this.messageQueue.has(toAgent)) {
      this.messageQueue.set(toAgent, []);
    }

    // Emit event for real-time delivery
    this.emit('message', {
      id: messageId,
      from_agent: fromAgent,
      to_agent: toAgent,
      deal_id: dealId,
      message_type: messageType,
      priority,
      subject,
      payload,
      status: 'pending',
      created_at: new Date(),
      correlation_id: correlationId,
    });

    logger.info('Message sent', { messageId });
    return messageId;
  }

  /**
   * Retrieve pending messages for an agent
   */
  async getPendingMessages(
    agentId: string,
    dealId?: string,
    limit: number = 50
  ): Promise<AgentMessage[]> {
    logger.info('Retrieving pending messages', { agentId, dealId });

    let query = `
      SELECT * FROM agent_messages
      WHERE to_agent = $1 AND status = 'pending'
    `;
    const params: any[] = [agentId];

    if (dealId) {
      query += ' AND deal_id = $2';
      params.push(dealId);
    }

    query += ' ORDER BY priority DESC, created_at ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.db.query<AgentMessage>(query, params);

    return result.rows.map((row) => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      response: row.response && typeof row.response === 'string'
        ? JSON.parse(row.response)
        : row.response,
    }));
  }

  /**
   * Mark message as delivered
   */
  async markMessageDelivered(messageId: string): Promise<void> {
    await this.db.query(
      `UPDATE agent_messages
       SET status = 'delivered', delivered_at = NOW()
       WHERE id = $1`,
      [messageId]
    );

    logger.info('Message marked as delivered', { messageId });
  }

  /**
   * Acknowledge message receipt and processing
   */
  async acknowledgeMessage(
    messageId: string,
    response?: Record<string, any>
  ): Promise<void> {
    await this.db.query(
      `UPDATE agent_messages
       SET status = 'acknowledged', response = $2
       WHERE id = $1`,
      [messageId, response ? JSON.stringify(response) : null]
    );

    logger.info('Message acknowledged', { messageId });
  }

  /**
   * Mark message as processed with response
   */
  async completeMessage(
    messageId: string,
    response: Record<string, any>
  ): Promise<void> {
    await this.db.query(
      `UPDATE agent_messages
       SET status = 'processed', processed_at = NOW(), response = $2
       WHERE id = $1`,
      [messageId, JSON.stringify(response)]
    );

    // Retrieve message details
    const msgResult = await this.db.query<AgentMessage>(
      'SELECT * FROM agent_messages WHERE id = $1',
      [messageId]
    );

    if (msgResult.rows.length > 0) {
      const message = msgResult.rows[0];
      this.emit('message_completed', { ...message, response });
    }

    logger.info('Message completed', { messageId });
  }

  /**
   * Search messages with filters
   */
  async searchMessages(filter: MessageFilter, limit: number = 100): Promise<AgentMessage[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.deal_id) {
      conditions.push(`deal_id = $${paramIndex++}`);
      params.push(filter.deal_id);
    }
    if (filter.from_agent) {
      conditions.push(`from_agent = $${paramIndex++}`);
      params.push(filter.from_agent);
    }
    if (filter.to_agent) {
      conditions.push(`to_agent = $${paramIndex++}`);
      params.push(filter.to_agent);
    }
    if (filter.message_type) {
      conditions.push(`message_type = $${paramIndex++}`);
      params.push(filter.message_type);
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filter.status);
    }
    if (filter.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(filter.priority);
    }
    if (filter.since) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filter.since);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `
      SELECT * FROM agent_messages
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query<AgentMessage>(query, params);

    return result.rows.map((row) => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      response: row.response && typeof row.response === 'string'
        ? JSON.parse(row.response)
        : row.response,
    }));
  }

  // ==========================================================================
  // DEPENDENCY MANAGEMENT
  // ==========================================================================

  /**
   * Create dependency between agents
   */
  async createDependency(
    dealId: string,
    sourceAgent: string,
    targetAgent: string,
    dependencyType: AgentDependency['dependency_type'],
    sourceEntityType: AgentDependency['source_entity_type'],
    sourceEntityId: string
  ): Promise<string> {
    logger.info('Creating agent dependency', {
      sourceAgent,
      targetAgent,
      dependencyType,
    });

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO agent_dependencies
       (deal_id, source_agent, target_agent, dependency_type, source_entity_type, source_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [dealId, sourceAgent, targetAgent, dependencyType, sourceEntityType, sourceEntityId]
    );

    const dependencyId = result.rows[0].id;

    // Send notification to target agent
    await this.sendMessage(
      sourceAgent,
      targetAgent,
      dealId,
      'dependency_update',
      `New dependency: ${dependencyType}`,
      {
        dependency_id: dependencyId,
        dependency_type: dependencyType,
        source_entity_type: sourceEntityType,
        source_entity_id: sourceEntityId,
      },
      'high'
    );

    logger.info('Dependency created', { dependencyId });
    return dependencyId;
  }

  /**
   * Resolve dependency with results
   */
  async resolveDependency(
    dependencyId: string,
    targetEntityType: AgentDependency['target_entity_type'],
    targetEntityId: string,
    resolutionData: Record<string, any>
  ): Promise<void> {
    logger.info('Resolving dependency', { dependencyId });

    await this.db.query(
      `UPDATE agent_dependencies
       SET status = 'satisfied',
           target_entity_type = $2,
           target_entity_id = $3,
           resolution_data = $4,
           resolved_at = NOW()
       WHERE id = $1`,
      [dependencyId, targetEntityType, targetEntityId, JSON.stringify(resolutionData)]
    );

    // Notify source agent of resolution
    const depResult = await this.db.query<AgentDependency>(
      'SELECT * FROM agent_dependencies WHERE id = $1',
      [dependencyId]
    );

    if (depResult.rows.length > 0) {
      const dep = depResult.rows[0];
      await this.sendMessage(
        dep.target_agent,
        dep.source_agent,
        dep.deal_id,
        'dependency_update',
        'Dependency resolved',
        {
          dependency_id: dependencyId,
          target_entity_type: targetEntityType,
          target_entity_id: targetEntityId,
          resolution_data: resolutionData,
        },
        'normal'
      );

      this.emit('dependency_resolved', dep);
    }

    logger.info('Dependency resolved', { dependencyId });
  }

  /**
   * Get pending dependencies for an agent
   */
  async getPendingDependencies(
    targetAgent: string,
    dealId?: string
  ): Promise<AgentDependency[]> {
    let query = `
      SELECT * FROM agent_dependencies
      WHERE target_agent = $1 AND status = 'pending'
    `;
    const params: any[] = [targetAgent];

    if (dealId) {
      query += ' AND deal_id = $2';
      params.push(dealId);
    }

    query += ' ORDER BY created_at ASC';

    const result = await this.db.query<AgentDependency>(query, params);

    return result.rows.map((row) => ({
      ...row,
      resolution_data: row.resolution_data && typeof row.resolution_data === 'string'
        ? JSON.parse(row.resolution_data)
        : row.resolution_data,
    }));
  }

  /**
   * Check if entity has unsatisfied dependencies
   */
  async hasUnsatisfiedDependencies(
    entityType: string,
    entityId: string
  ): Promise<boolean> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM agent_dependencies
       WHERE source_entity_type = $1 AND source_entity_id = $2 AND status = 'pending'`,
      [entityType, entityId]
    );

    return parseInt(result.rows[0]?.count || '0') > 0;
  }

  // ==========================================================================
  // COLLABORATIVE WORKFLOWS
  // ==========================================================================

  /**
   * Initialize collaborative task with multiple agents
   */
  async createCollaborativeTask(
    dealId: string,
    taskName: string,
    description: string,
    orchestratorAgent: string,
    participatingAgents: string[],
    dependencies: Array<{ agent: string; depends_on: string[] }>
  ): Promise<string> {
    logger.info('Creating collaborative task', {
      dealId,
      taskName,
      participatingAgents,
    });

    // Initialize progress map
    const progress: Record<string, 'pending'> = {};
    participatingAgents.forEach((agent) => {
      progress[agent] = 'pending';
    });

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO collaborative_tasks
       (deal_id, task_name, description, orchestrator_agent, participating_agents, dependencies, progress)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        dealId,
        taskName,
        description,
        orchestratorAgent,
        JSON.stringify(participatingAgents),
        JSON.stringify(dependencies),
        JSON.stringify(progress),
      ]
    );

    const taskId = result.rows[0].id;

    // Store in memory for fast access
    this.activeTasks.set(taskId, {
      id: taskId,
      deal_id: dealId,
      task_name: taskName,
      description,
      orchestrator_agent: orchestratorAgent,
      participating_agents: participatingAgents,
      dependencies,
      status: 'initialized',
      progress,
      results: {},
      created_at: new Date(),
    });

    // Notify all participating agents
    for (const agent of participatingAgents) {
      const agentDeps = dependencies.find((d) => d.agent === agent)?.depends_on || [];
      await this.sendMessage(
        orchestratorAgent,
        agent,
        dealId,
        'request_analysis',
        `Collaborative task: ${taskName}`,
        {
          task_id: taskId,
          task_name: taskName,
          description,
          dependencies: agentDeps,
        },
        'high'
      );
    }

    logger.info('Collaborative task created', { taskId });
    return taskId;
  }

  /**
   * Update task progress for an agent
   */
  async updateTaskProgress(
    taskId: string,
    agentId: string,
    status: 'in_progress' | 'completed' | 'failed',
    result?: Record<string, any>
  ): Promise<void> {
    logger.info('Updating task progress', { taskId, agentId, status });

    // Get current task
    const taskResult = await this.db.query<CollaborativeTask>(
      'SELECT * FROM collaborative_tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const task = taskResult.rows[0];
    const progress = typeof task.progress === 'string'
      ? JSON.parse(task.progress)
      : task.progress;
    const results = typeof task.results === 'string'
      ? JSON.parse(task.results)
      : task.results;

    progress[agentId] = status;
    if (result) {
      results[agentId] = result;
    }

    // Check if all agents completed
    const allCompleted = Object.values(progress).every(
      (s) => s === 'completed' || s === 'failed'
    );
    const taskStatus = allCompleted
      ? Object.values(progress).some((s) => s === 'failed')
        ? 'failed'
        : 'completed'
      : 'in_progress';

    await this.db.query(
      `UPDATE collaborative_tasks
       SET progress = $2, results = $3, status = $4, completed_at = $5
       WHERE id = $1`,
      [
        taskId,
        JSON.stringify(progress),
        JSON.stringify(results),
        taskStatus,
        allCompleted ? new Date() : null,
      ]
    );

    // Notify orchestrator of progress
    await this.sendMessage(
      agentId,
      task.orchestrator_agent,
      task.deal_id,
      'task_complete',
      `Task progress update: ${agentId}`,
      {
        task_id: taskId,
        agent_id: agentId,
        status,
        result,
      },
      'normal'
    );

    if (allCompleted) {
      this.emit('task_completed', { taskId, status: taskStatus, results });
    }

    logger.info('Task progress updated', { taskId, agentId, taskStatus });
  }

  /**
   * Get task status and results
   */
  async getTaskStatus(taskId: string): Promise<CollaborativeTask | null> {
    const result = await this.db.query<CollaborativeTask>(
      'SELECT * FROM collaborative_tasks WHERE id = $1',
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const task = result.rows[0];
    return {
      ...task,
      participating_agents: typeof task.participating_agents === 'string'
        ? JSON.parse(task.participating_agents)
        : task.participating_agents,
      dependencies: typeof task.dependencies === 'string'
        ? JSON.parse(task.dependencies)
        : task.dependencies,
      progress: typeof task.progress === 'string'
        ? JSON.parse(task.progress)
        : task.progress,
      results: typeof task.results === 'string'
        ? JSON.parse(task.results)
        : task.results,
    };
  }

  /**
   * Get all active tasks for a deal
   */
  async getActiveTasks(dealId: string): Promise<CollaborativeTask[]> {
    const result = await this.db.query<CollaborativeTask>(
      `SELECT * FROM collaborative_tasks
       WHERE deal_id = $1 AND status IN ('initialized', 'in_progress')
       ORDER BY created_at DESC`,
      [dealId]
    );

    return result.rows.map((task) => ({
      ...task,
      participating_agents: typeof task.participating_agents === 'string'
        ? JSON.parse(task.participating_agents)
        : task.participating_agents,
      dependencies: typeof task.dependencies === 'string'
        ? JSON.parse(task.dependencies)
        : task.dependencies,
      progress: typeof task.progress === 'string'
        ? JSON.parse(task.progress)
        : task.progress,
      results: typeof task.results === 'string'
        ? JSON.parse(task.results)
        : task.results,
    }));
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get communication statistics for a deal
   */
  async getCommunicationStats(dealId: string): Promise<{
    total_messages: number;
    pending_messages: number;
    active_dependencies: number;
    active_tasks: number;
    message_breakdown: Record<AgentMessageType, number>;
  }> {
    const [msgCountResult, depCountResult, taskCountResult, msgBreakdownResult] = await Promise.all([
      this.db.query<{ total: string; pending: string }>(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
         FROM agent_messages WHERE deal_id = $1`,
        [dealId]
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM agent_dependencies
         WHERE deal_id = $1 AND status = 'pending'`,
        [dealId]
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM collaborative_tasks
         WHERE deal_id = $1 AND status IN ('initialized', 'in_progress')`,
        [dealId]
      ),
      this.db.query<{ message_type: AgentMessageType; count: string }>(
        `SELECT message_type, COUNT(*) as count
         FROM agent_messages WHERE deal_id = $1
         GROUP BY message_type`,
        [dealId]
      ),
    ]);

    const messageBreakdown: Record<AgentMessageType, number> = {} as any;
    msgBreakdownResult.rows.forEach((row) => {
      messageBreakdown[row.message_type] = parseInt(row.count);
    });

    return {
      total_messages: parseInt(msgCountResult.rows[0]?.total || '0'),
      pending_messages: parseInt(msgCountResult.rows[0]?.pending || '0'),
      active_dependencies: parseInt(depCountResult.rows[0]?.count || '0'),
      active_tasks: parseInt(taskCountResult.rows[0]?.count || '0'),
      message_breakdown: messageBreakdown,
    };
  }
}
