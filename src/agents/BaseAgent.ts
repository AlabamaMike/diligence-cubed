/**
 * Base class for all agents in the platform
 */

import { Agent, AgentType, AgentStatus, AgentTask, AgentResponse, AgentContext } from '../types/agents';
import { logger } from '../utils/logger';

export abstract class BaseAgent implements Agent {
  public id: string;
  public type: AgentType;
  public name: string;
  public status: AgentStatus;
  public capabilities: string[];
  public mcpServers: string[];

  constructor(
    id: string,
    type: AgentType,
    name: string,
    capabilities: string[],
    mcpServers: string[]
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.status = 'idle';
    this.capabilities = capabilities;
    this.mcpServers = mcpServers;
  }

  /**
   * Execute a task assigned to this agent
   */
  async executeTask(task: AgentTask, context: AgentContext): Promise<AgentResponse> {
    logger.info(`Agent ${this.name} executing task`, { taskId: task.taskId });
    this.status = 'active';

    try {
      const result = await this.performTask(task, context);
      this.status = 'completed';

      return {
        agentType: this.type,
        taskId: task.taskId,
        success: true,
        data: result,
        confidence: this.calculateConfidence(result),
        sources: this.getSources(result),
        timestamp: new Date(),
      };
    } catch (error) {
      this.status = 'failed';
      logger.error(`Agent ${this.name} failed to execute task`, { error, taskId: task.taskId });

      return {
        agentType: this.type,
        taskId: task.taskId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0,
        sources: [],
        timestamp: new Date(),
      };
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * Abstract method to be implemented by each agent type
   */
  protected abstract performTask(task: AgentTask, context: AgentContext): Promise<unknown>;

  /**
   * Calculate confidence score for the result
   */
  protected abstract calculateConfidence(result: unknown): number;

  /**
   * Extract sources from the result
   */
  protected abstract getSources(result: unknown): string[];
}
