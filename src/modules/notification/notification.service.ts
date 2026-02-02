import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { LoggerService } from '../../common/logger/logger.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductDto } from '../api/dto/product.dto';

const execAsync = promisify(exec);

/**
 * Rate limiting configuration
 * Prevents spamming the same product notification within X minutes
 */
const RATE_LIMIT_MINUTES = 60;

@Injectable()
export class NotificationService {
  private readonly notificationCache: Map<string, number> = new Map();
  private readonly defaultPhoneNumber: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly databaseService: DatabaseService,
  ) {
    this.defaultPhoneNumber =
      this.configService.get<string>('NOTIFICATION_PHONE') || '';
    if (!this.defaultPhoneNumber) {
      this.logger.warn(
        'NOTIFICATION_PHONE not set in .env - notifications will require explicit phone number',
        'NotificationService',
      );
    }
  }

  /**
   * Send availability notification via WhatsApp using Clawdbot CLI
   *
   * @param product Product that became available
   * @param phoneNumber Target phone number in E.164 format (e.g., +50586826131)
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendAvailabilityNotification(
    product: ProductDto,
    phoneNumber?: string,
  ): Promise<boolean> {
    const targetPhone = phoneNumber || this.defaultPhoneNumber;

    if (!targetPhone) {
      this.logger.error(
        'Cannot send notification: no phone number provided',
        'NotificationService',
      );
      return false;
    }

    // Rate limiting check
    if (this.isRateLimited(product.id)) {
      this.logger.warn(
        `Rate limit hit for product ${product.id} - skipping notification`,
        'NotificationService',
      );
      return false;
    }

    try {
      const message = this.formatNotificationMessage(product);

      this.logger.log(
        `Sending availability notification for product: ${product.title}`,
        'NotificationService',
      );

      // Execute Clawdbot CLI command
      const command = `clawdbot message send --channel whatsapp --target "${targetPhone}" --message "${this.escapeMessage(message)}"`;

      await execAsync(command, {
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      // Update rate limit cache
      this.notificationCache.set(product.id, Date.now());

      // Record notification in database
      this.recordNotification(product.id, true);

      this.logger.log(
        `Notification sent successfully for product: ${product.title}`,
        'NotificationService',
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send notification for product ${product.id}: ${error.message}`,
        'NotificationService',
      );

      // Record failed notification
      this.recordNotification(product.id, false);

      return false;
    }
  }

  /**
   * Format a beautiful WhatsApp message with product details
   */
  private formatNotificationMessage(product: ProductDto): string {
    const lines: string[] = [];

    lines.push('🔔 *PRODUCTO DISPONIBLE* 🔔');
    lines.push('');
    lines.push(`📦 *${product.title}*`);
    lines.push('');

    if (product.price > 0) {
      lines.push(`💰 Precio: *$${product.price.toFixed(2)}*`);
    }

    // Show available variants count
    const availableVariants = product.variants.filter((v) => v.available);
    if (availableVariants.length > 0) {
      lines.push(`📊 Variantes disponibles: *${availableVariants.length}*`);

      // List variants if not too many
      if (availableVariants.length <= 5) {
        availableVariants.forEach((variant) => {
          const stock =
            variant.inventoryQuantity > 0
              ? ` (${variant.inventoryQuantity} en stock)`
              : '';
          lines.push(`   • ${variant.title}${stock}`);
        });
      }
    }

    lines.push('');
    lines.push(`🔗 ${product.url}`);
    lines.push('');
    lines.push('_¡Compra ahora antes de que se agote!_ 🚀');

    return lines.join('\n');
  }

  /**
   * Escape special characters for shell command
   */
  private escapeMessage(message: string): string {
    return message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  /**
   * Check if a product notification is rate limited
   */
  private isRateLimited(productId: string): boolean {
    const lastNotification = this.notificationCache.get(productId);

    if (!lastNotification) {
      return false;
    }

    const minutesSinceLastNotification =
      (Date.now() - lastNotification) / (1000 * 60);

    return minutesSinceLastNotification < RATE_LIMIT_MINUTES;
  }

  /**
   * Record notification in database
   */
  private recordNotification(productId: string, sent: boolean): void {
    try {
      const db = this.databaseService.getDatabase();

      db.prepare(
        `
        INSERT INTO notifications (product_id, timestamp, sent)
        VALUES (?, ?, ?)
      `,
      ).run(productId, Date.now(), sent ? 1 : 0);

      this.logger.log(
        `Recorded notification for product ${productId} (sent: ${sent})`,
        'NotificationService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to record notification: ${error.message}`,
        'NotificationService',
      );
    }
  }

  /**
   * Get notification history for a product
   */
  getNotificationHistory(productId: string, limit: number = 10): any[] {
    try {
      const db = this.databaseService.getDatabase();

      return db
        .prepare(
          `
          SELECT * FROM notifications 
          WHERE product_id = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        `,
        )
        .all(productId, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get notification history: ${error.message}`,
        'NotificationService',
      );
      return [];
    }
  }

  /**
   * Clear rate limit cache for testing purposes
   */
  clearRateLimitCache(): void {
    this.notificationCache.clear();
    this.logger.log('Rate limit cache cleared', 'NotificationService');
  }

  /**
   * Get rate limit status for a product
   */
  getRateLimitStatus(productId: string): {
    isLimited: boolean;
    lastNotification: number | null;
    minutesUntilUnlocked: number | null;
  } {
    const lastNotification = this.notificationCache.get(productId);

    if (!lastNotification) {
      return {
        isLimited: false,
        lastNotification: null,
        minutesUntilUnlocked: null,
      };
    }

    const minutesSince = (Date.now() - lastNotification) / (1000 * 60);
    const isLimited = minutesSince < RATE_LIMIT_MINUTES;

    return {
      isLimited,
      lastNotification,
      minutesUntilUnlocked: isLimited
        ? Math.ceil(RATE_LIMIT_MINUTES - minutesSince)
        : null,
    };
  }
}
