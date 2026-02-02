import { Injectable, OnModuleInit } from '@nestjs/common';
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
export class NotificationService implements OnModuleInit {
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
   * Initialize service and rebuild rate limit cache from database
   */
  async onModuleInit() {
    this.rebuildRateLimitCache();
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
   * Rebuild rate limit cache from database
   * Called on module initialization to restore state after restart
   */
  private rebuildRateLimitCache(): void {
    try {
      const db = this.databaseService.getDatabase();

      // Calculate timestamp threshold (current time - rate limit window)
      const rateLimitThreshold = Date.now() - RATE_LIMIT_MINUTES * 60 * 1000;

      // Get last successful notification for each product within rate limit window
      const recentNotifications = db
        .prepare(
          `
          SELECT product_id, MAX(timestamp) as last_sent
          FROM notifications
          WHERE sent = 1 AND timestamp > ?
          GROUP BY product_id
        `,
        )
        .all(rateLimitThreshold) as Array<{
        product_id: string;
        last_sent: number;
      }>;

      // Rebuild cache
      this.notificationCache.clear();
      for (const row of recentNotifications) {
        this.notificationCache.set(row.product_id, row.last_sent);
      }

      this.logger.log(
        `Rate limit cache rebuilt with ${recentNotifications.length} entries`,
        'NotificationService',
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to rebuild rate limit cache: ${error.message}`,
        'NotificationService',
      );
    }
  }

  /**
   * Check if a product should be notified based on filters
   * (minimum price, keywords, etc.)
   */
  shouldNotify(product: ProductDto): boolean {
    const minPriceStr = this.configService.get<string>(
      'LUMENTUI_NOTIFY_MIN_PRICE',
    );
    const keywordsStr = this.configService.get<string>(
      'LUMENTUI_NOTIFY_KEYWORDS',
    );

    // Check minimum price filter
    if (minPriceStr) {
      const minPrice = parseFloat(minPriceStr);
      if (!isNaN(minPrice) && minPrice > 0) {
        // Check product price and variant prices
        const productMeetsPrice = product.price >= minPrice;
        const hasExpensiveVariant = product.variants.some(
          (v) => v.price >= minPrice,
        );

        if (!productMeetsPrice && !hasExpensiveVariant) {
          this.logger.log(
            `Product ${product.id} filtered out: price ${product.price} and all variants below minimum ${minPrice}`,
            'NotificationService',
          );
          return false;
        }
      }
    }

    // Check keywords filter
    if (keywordsStr && keywordsStr.trim()) {
      const keywordList = keywordsStr
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);

      if (keywordList.length > 0) {
        const titleLower = product.title.toLowerCase();
        const hasKeyword = keywordList.some((keyword) =>
          titleLower.includes(keyword),
        );

        if (!hasKeyword) {
          this.logger.log(
            `Product ${product.id} filtered out: title does not contain any of [${keywordList.join(', ')}]`,
            'NotificationService',
          );
          return false;
        }
      }
    }

    // If neither filter is set, or all checks pass, notify
    return true;
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
