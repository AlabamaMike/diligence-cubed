/**
 * Microsoft Teams Bot Integration
 * Provides interactive notifications and commands via Teams
 */

import { DatabaseClient } from '../database/client';
import { NotificationService } from '../services/NotificationService';
import { NaturalLanguageQueryService } from '../services/NaturalLanguageQueryService';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { DealRepository } from '../database/repositories/DealRepository';
import { logger } from '../utils/logger';

export interface TeamsMessage {
  type: 'message' | 'card' | 'adaptive_card';
  text?: string;
  card?: TeamsCard;
  conversation_id: string;
  user_id: string;
}

export interface TeamsCard {
  type: 'notification' | 'finding' | 'approval_request' | 'summary';
  title: string;
  subtitle?: string;
  text: string;
  actions?: Array<{
    type: 'Action.Submit' | 'Action.OpenUrl';
    title: string;
    url?: string;
    data?: Record<string, any>;
  }>;
  facts?: Array<{ title: string; value: string }>;
}

export interface TeamsNotificationOptions {
  deal_id: string;
  user_ids: string[];
  priority: 'critical' | 'high' | 'normal' | 'low';
  notification_type: string;
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: string;
    data?: Record<string, any>;
  }>;
}

/**
 * Teams Bot Service
 * Handles Microsoft Teams integration for notifications and commands
 */
export class TeamsBotService {
  private notificationService: NotificationService;
  private queryService: NaturalLanguageQueryService;
  private findingRepo: FindingRepository;
  private dealRepo: DealRepository;
  private webhookUrl?: string;

  constructor(private db: DatabaseClient) {
    this.notificationService = new NotificationService(db);
    this.queryService = new NaturalLanguageQueryService(db);
    this.findingRepo = new FindingRepository(db);
    this.dealRepo = new DealRepository(db);
    this.webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  }

  // ============================================================================
  // OUTBOUND NOTIFICATIONS
  // ============================================================================

  /**
   * Send notification to Teams
   */
  async sendNotification(options: TeamsNotificationOptions): Promise<void> {
    logger.info('Sending Teams notification', {
      dealId: options.deal_id,
      recipientCount: options.user_ids.length,
      type: options.notification_type,
    });

    // Create adaptive card based on notification type
    const card = this.createNotificationCard(options);

    // Send to each user (would use actual Teams API)
    for (const userId of options.user_ids) {
      try {
        await this.sendTeamsMessage({
          type: 'adaptive_card',
          card,
          conversation_id: await this.getUserConversationId(userId),
          user_id: userId,
        });

        // Also create in-app notification
        await this.notificationService.create({
          deal_id: options.deal_id,
          user_id: userId,
          notification_type: options.notification_type,
          title: options.title,
          message: options.message,
          priority: options.priority,
          delivery_channels: ['teams', 'in_app'],
        });
      } catch (error) {
        logger.error('Failed to send Teams notification', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Send red flag alert to Teams
   */
  async sendRedFlagAlert(
    dealId: string,
    findingId: string,
    userIds: string[]
  ): Promise<void> {
    const finding = await this.findingRepo.findById(findingId);
    if (!finding) {
      throw new Error('Finding not found');
    }

    const deal = await this.dealRepo.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const card: TeamsCard = {
      type: 'finding',
      title: `🚩 Red Flag Alert: ${deal.name}`,
      subtitle: finding.title,
      text: finding.description.substring(0, 500) + (finding.description.length > 500 ? '...' : ''),
      facts: [
        { title: 'Impact', value: finding.impact_level || 'N/A' },
        { title: 'Confidence', value: `${(finding.confidence_score * 100).toFixed(0)}%` },
        { title: 'Workstream', value: finding.generated_by_agent },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Finding',
          url: `${process.env.APP_URL}/deals/${dealId}/findings/${findingId}`,
        },
        {
          type: 'Action.Submit',
          title: 'Acknowledge',
          data: { action: 'acknowledge_finding', finding_id: findingId },
        },
      ],
    };

    for (const userId of userIds) {
      await this.sendTeamsMessage({
        type: 'adaptive_card',
        card,
        conversation_id: await this.getUserConversationId(userId),
        user_id: userId,
      });
    }

    logger.info('Red flag alert sent', { dealId, findingId, recipientCount: userIds.length });
  }

  /**
   * Send approval request to Teams
   */
  async sendApprovalRequest(
    dealId: string,
    entityType: string,
    entityId: string,
    title: string,
    description: string,
    userIds: string[]
  ): Promise<void> {
    const card: TeamsCard = {
      type: 'approval_request',
      title: `⏰ Approval Required`,
      subtitle: title,
      text: description,
      actions: [
        {
          type: 'Action.Submit',
          title: 'Approve',
          data: {
            action: 'approve',
            entity_type: entityType,
            entity_id: entityId,
            deal_id: dealId,
          },
        },
        {
          type: 'Action.Submit',
          title: 'Reject',
          data: {
            action: 'reject',
            entity_type: entityType,
            entity_id: entityId,
            deal_id: dealId,
          },
        },
        {
          type: 'Action.OpenUrl',
          title: 'View Details',
          url: `${process.env.APP_URL}/deals/${dealId}/${entityType}/${entityId}`,
        },
      ],
    };

    for (const userId of userIds) {
      await this.sendTeamsMessage({
        type: 'adaptive_card',
        card,
        conversation_id: await this.getUserConversationId(userId),
        user_id: userId,
      });
    }

    logger.info('Approval request sent', { dealId, entityType, entityId, recipientCount: userIds.length });
  }

  /**
   * Send daily progress summary
   */
  async sendDailyProgressSummary(dealId: string, userIds: string[]): Promise<void> {
    const deal = await this.dealRepo.findById(dealId);
    const summary = await this.dealRepo.getSummary(dealId);
    const stats = await this.findingRepo.getStatistics(dealId);

    if (!deal || !summary) {
      return;
    }

    const card: TeamsCard = {
      type: 'summary',
      title: `📊 Daily Progress: ${deal.name}`,
      subtitle: `Phase: ${deal.current_phase}`,
      text: 'Here\'s your daily progress update',
      facts: [
        { title: 'Workstream Progress', value: `${summary.avg_workstream_progress?.toFixed(0) || 0}%` },
        { title: 'New Findings (Today)', value: stats.totalCount.toString() },
        { title: 'Red Flags', value: stats.redFlagCount.toString() },
        { title: 'Documents Processed', value: summary.document_count?.toString() || '0' },
        { title: 'Pending Approvals', value: stats.pendingCount.toString() },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Dashboard',
          url: `${process.env.APP_URL}/deals/${dealId}/dashboard`,
        },
      ],
    };

    for (const userId of userIds) {
      await this.sendTeamsMessage({
        type: 'adaptive_card',
        card,
        conversation_id: await this.getUserConversationId(userId),
        user_id: userId,
      });
    }

    logger.info('Daily progress summary sent', { dealId, recipientCount: userIds.length });
  }

  // ============================================================================
  // INBOUND COMMANDS
  // ============================================================================

  /**
   * Handle incoming Teams message
   */
  async handleIncomingMessage(message: {
    text: string;
    user_id: string;
    conversation_id: string;
  }): Promise<void> {
    const text = message.text.toLowerCase().trim();

    logger.info('Processing Teams message', { userId: message.user_id, text: text.substring(0, 50) });

    // Parse command
    if (text.startsWith('/')) {
      await this.handleCommand(text, message.user_id, message.conversation_id);
    } else {
      // Natural language query
      await this.handleQuery(text, message.user_id, message.conversation_id);
    }
  }

  /**
   * Handle slash commands
   * @private
   */
  private async handleCommand(
    command: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case '/status':
          await this.handleStatusCommand(userId, conversationId, args[0]);
          break;

        case '/findings':
          await this.handleFindingsCommand(userId, conversationId, args[0]);
          break;

        case '/redflags':
          await this.handleRedFlagsCommand(userId, conversationId, args[0]);
          break;

        case '/summary':
          await this.handleSummaryCommand(userId, conversationId, args[0]);
          break;

        case '/help':
          await this.handleHelpCommand(userId, conversationId);
          break;

        default:
          await this.sendTextMessage(
            conversationId,
            userId,
            `Unknown command: ${cmd}. Type /help for available commands.`
          );
      }
    } catch (error) {
      await this.sendTextMessage(
        conversationId,
        userId,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle natural language query
   * @private
   */
  private async handleQuery(
    query: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    try {
      // Get user's active deals
      const deals = await this.db.query(
        `SELECT deal_id FROM deal_access WHERE user_id = $1 LIMIT 1`,
        [userId]
      );

      if (deals.rows.length === 0) {
        await this.sendTextMessage(
          conversationId,
          userId,
          'You don\'t have access to any deals. Please specify a deal ID.'
        );
        return;
      }

      const dealId = deals.rows[0].deal_id;

      // Process query
      const response = await this.queryService.query(query, {
        deal_id: dealId,
        user_id: userId,
      });

      // Send response
      const card: TeamsCard = {
        type: 'notification',
        title: 'Query Response',
        subtitle: `Confidence: ${(response.confidence * 100).toFixed(0)}%`,
        text: response.answer,
        facts: response.sources.slice(0, 3).map((s) => ({
          title: 'Source',
          value: s.title,
        })),
        actions: response.suggested_followups.slice(0, 3).map((q) => ({
          type: 'Action.Submit' as const,
          title: q,
          data: { action: 'query', query: q },
        })),
      };

      await this.sendTeamsMessage({
        type: 'adaptive_card',
        card,
        conversation_id: conversationId,
        user_id: userId,
      });
    } catch (error) {
      await this.sendTextMessage(
        conversationId,
        userId,
        `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle status command
   * @private
   */
  private async handleStatusCommand(
    userId: string,
    conversationId: string,
    dealId?: string
  ): Promise<void> {
    if (!dealId) {
      await this.sendTextMessage(conversationId, userId, 'Usage: /status <deal_id>');
      return;
    }

    const deal = await this.dealRepo.findById(dealId);
    const summary = await this.dealRepo.getSummary(dealId);

    if (!deal || !summary) {
      await this.sendTextMessage(conversationId, userId, 'Deal not found');
      return;
    }

    const message = `**${deal.name}**
Phase: ${deal.current_phase}
Progress: ${summary.avg_workstream_progress?.toFixed(0) || 0}%
Findings: ${summary.finding_count || 0} (${summary.red_flag_count || 0} red flags)
Documents: ${summary.document_count || 0}`;

    await this.sendTextMessage(conversationId, userId, message);
  }

  /**
   * Handle findings command
   * @private
   */
  private async handleFindingsCommand(
    userId: string,
    conversationId: string,
    dealId?: string
  ): Promise<void> {
    if (!dealId) {
      await this.sendTextMessage(conversationId, userId, 'Usage: /findings <deal_id>');
      return;
    }

    const findings = await this.findingRepo.findByDeal(dealId, { limit: 5 });

    if (findings.length === 0) {
      await this.sendTextMessage(conversationId, userId, 'No findings yet');
      return;
    }

    const message = `**Recent Findings (${findings.length})**\n\n` +
      findings.map((f, i) =>
        `${i + 1}. **${f.title}**\n   Type: ${f.finding_type}, Impact: ${f.impact_level || 'N/A'}`
      ).join('\n\n');

    await this.sendTextMessage(conversationId, userId, message);
  }

  /**
   * Handle red flags command
   * @private
   */
  private async handleRedFlagsCommand(
    userId: string,
    conversationId: string,
    dealId?: string
  ): Promise<void> {
    if (!dealId) {
      await this.sendTextMessage(conversationId, userId, 'Usage: /redflags <deal_id>');
      return;
    }

    const redFlags = await this.findingRepo.getRedFlags(dealId);

    if (redFlags.length === 0) {
      await this.sendTextMessage(conversationId, userId, 'No red flags identified ✅');
      return;
    }

    const message = `**🚩 Red Flags (${redFlags.length})**\n\n` +
      redFlags.slice(0, 5).map((f, i) =>
        `${i + 1}. **${f.title}**\n   Impact: ${f.impact_level || 'N/A'}, Confidence: ${(f.confidence_score * 100).toFixed(0)}%`
      ).join('\n\n');

    await this.sendTextMessage(conversationId, userId, message);
  }

  /**
   * Handle summary command
   * @private
   */
  private async handleSummaryCommand(
    userId: string,
    conversationId: string,
    dealId?: string
  ): Promise<void> {
    if (!dealId) {
      const deals = await this.db.query(
        `SELECT d.id, d.name FROM deals d
         JOIN deal_access da ON da.deal_id = d.id
         WHERE da.user_id = $1 LIMIT 5`,
        [userId]
      );

      if (deals.rows.length === 0) {
        await this.sendTextMessage(conversationId, userId, 'No accessible deals');
        return;
      }

      const message = '**Your Deals:**\n\n' +
        deals.rows.map((d, i) => `${i + 1}. ${d.name} (ID: ${d.id})`).join('\n');

      await this.sendTextMessage(conversationId, userId, message);
    } else {
      await this.sendDailyProgressSummary(dealId, [userId]);
    }
  }

  /**
   * Handle help command
   * @private
   */
  private async handleHelpCommand(userId: string, conversationId: string): Promise<void> {
    const helpText = `**Available Commands:**

**/status** <deal_id> - Get deal status
**/findings** <deal_id> - List recent findings
**/redflags** <deal_id> - Show red flags
**/summary** [deal_id] - Daily progress summary
**/help** - Show this help message

**Natural Language:**
You can also ask questions like:
- "What are the financial risks?"
- "Show me the market analysis"
- "What's the QoE assessment?"`;

    await this.sendTextMessage(conversationId, userId, helpText);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Send Teams message
   * @private
   */
  private async sendTeamsMessage(message: TeamsMessage): Promise<void> {
    // TODO: Implement actual Teams Bot Framework API calls
    // This would use Microsoft Bot Framework SDK

    logger.info('Teams message sent (placeholder)', {
      type: message.type,
      userId: message.user_id,
      conversationId: message.conversation_id,
    });

    // Placeholder implementation
    if (this.webhookUrl) {
      // Would send via webhook in production
    }
  }

  /**
   * Send simple text message
   * @private
   */
  private async sendTextMessage(
    conversationId: string,
    userId: string,
    text: string
  ): Promise<void> {
    await this.sendTeamsMessage({
      type: 'message',
      text,
      conversation_id: conversationId,
      user_id: userId,
    });
  }

  /**
   * Create notification card
   * @private
   */
  private createNotificationCard(options: TeamsNotificationOptions): TeamsCard {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      normal: '🟢',
      low: '⚪',
    };

    return {
      type: 'notification',
      title: `${priorityEmoji[options.priority]} ${options.title}`,
      text: options.message,
      actions: options.actions?.map((a) => ({
        type: 'Action.Submit' as const,
        title: a.label,
        data: { action: a.action, ...a.data },
      })),
    };
  }

  /**
   * Get user's Teams conversation ID
   * @private
   */
  private async getUserConversationId(userId: string): Promise<string> {
    // TODO: Map platform user ID to Teams conversation ID
    // Would query user_teams_mapping table
    return `conversation_${userId}`;
  }
}
