/**
 * Notification Service
 * Manages notifications with Teams integration support
 */

import { DatabaseClient } from '../database/client';
import { Notification, NotificationPriority } from '../types/database';
import { logger } from '../utils/logger';

export interface CreateNotificationInput {
  deal_id?: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  related_entity_type?: string;
  related_entity_id?: string;
  delivery_channels?: string[];
}

export interface NotificationSearchOptions {
  deal_id?: string;
  user_id?: string;
  notification_type?: string;
  priority?: NotificationPriority;
  is_read?: boolean;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  constructor(private db: DatabaseClient) {}

  /**
   * Create a notification
   */
  async create(input: CreateNotificationInput): Promise<Notification> {
    const query = `
      INSERT INTO notifications (
        deal_id, user_id, notification_type, title, message,
        priority, related_entity_type, related_entity_id, delivery_channels
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      input.deal_id,
      input.user_id,
      input.notification_type,
      input.title,
      input.message,
      input.priority || 'normal',
      input.related_entity_type,
      input.related_entity_id,
      input.delivery_channels || ['in_app'],
    ];

    const result = await this.db.query<Notification>(query, values);

    logger.info('Notification created', {
      notificationId: result.rows[0].id,
      userId: input.user_id,
      type: input.notification_type,
      priority: input.priority,
    });

    // Trigger delivery based on channels
    await this.deliverNotification(result.rows[0]);

    return result.rows[0];
  }

  /**
   * Get notification by ID
   */
  async getById(notificationId: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await this.db.query<Notification>(query, [notificationId]);
    return result.rows[0] || null;
  }

  /**
   * Search notifications
   */
  async search(options: NotificationSearchOptions = {}): Promise<Notification[]> {
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (options.deal_id) {
      query += ` AND deal_id = $${paramCount}`;
      params.push(options.deal_id);
      paramCount++;
    }

    if (options.user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(options.user_id);
      paramCount++;
    }

    if (options.notification_type) {
      query += ` AND notification_type = $${paramCount}`;
      params.push(options.notification_type);
      paramCount++;
    }

    if (options.priority) {
      query += ` AND priority = $${paramCount}`;
      params.push(options.priority);
      paramCount++;
    }

    if (options.is_read !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      params.push(options.is_read);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(options.limit || 50, options.offset || 0);

    const result = await this.db.query<Notification>(query, params);
    return result.rows;
  }

  /**
   * Get unread notifications for a user
   */
  async getUnread(userId: string, limit = 50): Promise<Notification[]> {
    return this.search({ user_id: userId, is_read: false, limit });
  }

  /**
   * Get notifications for a deal
   */
  async getByDeal(dealId: string, limit = 50, offset = 0): Promise<Notification[]> {
    return this.search({ deal_id: dealId, limit, offset });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification | null> {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<Notification>(query, [notificationId]);
    return result.rows[0] || null;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<number> {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = ANY($1::uuid[])
    `;

    const result = await this.db.query(query, [notificationIds]);
    return result.rowCount || 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
    `;

    const result = await this.db.query(query, [userId]);
    logger.info('Marked all notifications as read', { userId, count: result.rowCount });
    return result.rowCount || 0;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string, dealId?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false';
    const params: any[] = [userId];

    if (dealId) {
      query += ' AND deal_id = $2';
      params.push(dealId);
    }

    const result = await this.db.query<{ count: string }>(query, params);
    return parseInt(result.rows[0]?.count || '0');
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string): Promise<boolean> {
    const query = 'DELETE FROM notifications WHERE id = $1';
    const result = await this.db.query(query, [notificationId]);
    return (result.rowCount || 0) > 0;
  }

  // ============================================================================
  // NOTIFICATION CREATION HELPERS
  // ============================================================================

  /**
   * Notify about red flag
   */
  async notifyRedFlag(
    dealId: string,
    userIds: string[],
    findingId: string,
    findingTitle: string,
    impactLevel: string
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const notification = await this.create({
        deal_id: dealId,
        user_id: userId,
        notification_type: 'red_flag',
        title: `🚩 Red Flag: ${findingTitle}`,
        message: `A ${impactLevel} impact red flag has been identified: ${findingTitle}`,
        priority: 'critical',
        related_entity_type: 'finding',
        related_entity_id: findingId,
        delivery_channels: ['in_app', 'teams', 'email'],
      });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Notify about approval needed
   */
  async notifyApprovalNeeded(
    dealId: string,
    userIds: string[],
    entityType: string,
    entityId: string,
    title: string
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const notification = await this.create({
        deal_id: dealId,
        user_id: userId,
        notification_type: 'approval_needed',
        title: `⏰ Approval Required: ${title}`,
        message: `Your approval is required for: ${title}`,
        priority: 'high',
        related_entity_type: entityType,
        related_entity_id: entityId,
        delivery_channels: ['in_app', 'teams'],
      });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Notify about finding ready for review
   */
  async notifyFindingReady(
    dealId: string,
    userId: string,
    findingId: string,
    findingTitle: string
  ): Promise<Notification> {
    return this.create({
      deal_id: dealId,
      user_id: userId,
      notification_type: 'finding_ready',
      title: `✅ Finding Ready: ${findingTitle}`,
      message: `A new finding is ready for your review: ${findingTitle}`,
      priority: 'normal',
      related_entity_type: 'finding',
      related_entity_id: findingId,
      delivery_channels: ['in_app'],
    });
  }

  /**
   * Notify about phase completion
   */
  async notifyPhaseComplete(
    dealId: string,
    userIds: string[],
    phaseName: string
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const notification = await this.create({
        deal_id: dealId,
        user_id: userId,
        notification_type: 'phase_complete',
        title: `🎯 Phase Complete: ${phaseName}`,
        message: `The ${phaseName} phase has been completed successfully.`,
        priority: 'high',
        related_entity_type: 'deal',
        related_entity_id: dealId,
        delivery_channels: ['in_app', 'teams'],
      });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Notify about document processing complete
   */
  async notifyDocumentProcessed(
    dealId: string,
    userId: string,
    documentId: string,
    filename: string
  ): Promise<Notification> {
    return this.create({
      deal_id: dealId,
      user_id: userId,
      notification_type: 'document_processed',
      title: `📄 Document Processed: ${filename}`,
      message: `Your document has been processed and is ready for analysis.`,
      priority: 'low',
      related_entity_type: 'document',
      related_entity_id: documentId,
      delivery_channels: ['in_app'],
    });
  }

  /**
   * Daily progress summary
   */
  async notifyDailyProgress(
    dealId: string,
    userId: string,
    summary: {
      newFindings: number;
      documentsProcessed: number;
      pendingApprovals: number;
    }
  ): Promise<Notification> {
    return this.create({
      deal_id: dealId,
      user_id: userId,
      notification_type: 'daily_summary',
      title: '📊 Daily Progress Summary',
      message: `Today: ${summary.newFindings} new findings, ${summary.documentsProcessed} documents processed, ${summary.pendingApprovals} pending approvals.`,
      priority: 'low',
      related_entity_type: 'deal',
      related_entity_id: dealId,
      delivery_channels: ['in_app', 'teams'],
    });
  }

  // ============================================================================
  // DELIVERY
  // ============================================================================

  /**
   * Deliver notification through specified channels
   * @private
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    const channels = notification.delivery_channels || ['in_app'];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'teams':
            await this.deliverToTeams(notification);
            break;
          case 'email':
            await this.deliverToEmail(notification);
            break;
          case 'in_app':
            // In-app is handled by database storage
            break;
          default:
            logger.warn('Unknown notification channel', { channel });
        }
      } catch (error) {
        logger.error('Failed to deliver notification', {
          notificationId: notification.id,
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Mark as delivered
    await this.db.query(
      'UPDATE notifications SET delivered_at = NOW() WHERE id = $1',
      [notification.id]
    );
  }

  /**
   * Deliver to Microsoft Teams
   * @private
   */
  private async deliverToTeams(notification: Notification): Promise<void> {
    // TODO: Implement Teams bot integration
    // This would use the Microsoft Bot Framework or Teams webhook
    logger.debug('Teams delivery (not implemented)', {
      notificationId: notification.id,
    });
  }

  /**
   * Deliver via email
   * @private
   */
  private async deliverToEmail(notification: Notification): Promise<void> {
    // TODO: Implement email delivery
    // This would use SendGrid, AWS SES, or similar
    logger.debug('Email delivery (not implemented)', {
      notificationId: notification.id,
    });
  }
}
