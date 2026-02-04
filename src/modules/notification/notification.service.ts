import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { LoggerService } from '../../common/logger/logger.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductDto } from '../api/dto/product.dto';

/**
 * Rate limiting configuration
 * Prevents spamming the same product notification within X minutes
 */
const RATE_LIMIT_MINUTES = 60;

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly notificationCache: Map<string, number> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Initialize service and rebuild rate limit cache from database
   */
  onModuleInit(): void {
    this.rebuildRateLimitCache();
  }

  /**
   * Send availability notification via native macOS notifications
   *
   * @param product Product that became available
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendAvailabilityNotification(product: ProductDto): Promise<boolean> {
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

      // Send native macOS notification via osascript
      await this.sendNativeNotification(message);

      // Update rate limit cache
      this.notificationCache.set(product.id, Date.now());

      // Record notification in database with metadata
      this.recordNotification(product.id, true, {
        productTitle: product.title,
        availabilityChange: this.describeAvailabilityChange(product),
      });

      this.logger.log(
        `Notification sent successfully for product: ${product.title}`,
        'NotificationService',
      );

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send notification for product ${product.id}: ${errorMessage}`,
        'NotificationService',
      );

      // Record failed notification with error message
      this.recordNotification(product.id, false, {
        productTitle: product.title,
        availabilityChange: this.describeAvailabilityChange(product),
        errorMessage,
      });

      return false;
    }
  }

  /**
   * Format a concise notification message for macOS notification center
   */
  private formatNotificationMessage(product: ProductDto): string {
    const lines: string[] = [];

    lines.push(`${product.title}`);

    if (product.price > 0) {
      lines.push(`Price: $${product.price.toFixed(2)}`);
    }

    // Show available variants count
    const availableVariants = product.variants.filter((v) => v.available);
    if (availableVariants.length > 0) {
      lines.push(`${availableVariants.length} variant(s) available`);
    }

    lines.push(`${product.url}`);

    return lines.join('\n');
  }

  /**
   * Describe the availability change for a product
   */
  private describeAvailabilityChange(product: ProductDto): string {
    const availableVariants = product.variants.filter((v) => v.available);

    if (product.available && availableVariants.length > 0) {
      return `became available (${availableVariants.length} variant(s))`;
    } else if (product.available) {
      return 'became available';
    } else {
      return 'sold out';
    }
  }

  /**
   * Send a native macOS notification via osascript.
   * Works reliably from detached daemon processes.
   */
  private sendNativeNotification(message: string): Promise<void> {
    const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `display notification "${escaped}" with title "LumenTUI" subtitle "New Product Available" sound name "default"`;
    return new Promise<void>((resolve, reject) => {
      execFile('osascript', ['-e', script], (error: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
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
  private recordNotification(
    productId: string,
    sent: boolean,
    options?: {
      productTitle?: string;
      availabilityChange?: string;
      errorMessage?: string;
    },
  ): void {
    this.databaseService.recordNotification(productId, sent, options);
  }

  /**
   * Get notification history for a product
   */
  getNotificationHistory(productId: string, limit: number = 10): any[] {
    return this.databaseService.getNotificationHistory({ productId, limit });
  }

  /**
   * Get formatted notification history with filters
   * Transforms raw database entities into easily consumable format for CLI/TUI
   */
  getFormattedHistory(filters?: {
    dateFrom?: string;
    dateTo?: string;
    productId?: string;
    status?: 'sent' | 'failed';
    limit?: number;
    offset?: number;
  }): Array<{
    id: number;
    productId: string;
    productTitle: string | null;
    timestamp: number;
    formattedTimestamp: string;
    status: 'sent' | 'failed';
    availabilityChange: string | null;
    errorMessage: string | null;
  }> {
    try {
      const rawHistory = this.databaseService.getNotificationHistory(filters);

      return rawHistory.map((notification) => ({
        id: notification.id || 0,
        productId: notification.product_id,
        productTitle: notification.product_title || null,
        timestamp: notification.timestamp,
        formattedTimestamp: this.formatTimestamp(notification.timestamp),
        status: notification.sent === 1 ? 'sent' : 'failed',
        availabilityChange: notification.availability_change || null,
        errorMessage: notification.error_message || null,
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get formatted notification history: ${errorMessage}`,
        'NotificationService',
      );
      return [];
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    totalSent: number;
    totalFailed: number;
    countByProduct: Array<{
      productId: string;
      productTitle: string | null;
      sentCount: number;
      failedCount: number;
      totalCount: number;
    }>;
  } {
    try {
      const stats = this.databaseService.getNotificationStats();

      return {
        totalSent: stats.totalSent,
        totalFailed: stats.totalFailed,
        countByProduct: stats.countByProduct.map((item) => ({
          productId: item.product_id,
          productTitle: item.product_title,
          sentCount: item.sent_count,
          failedCount: item.failed_count,
          totalCount: item.sent_count + item.failed_count,
        })),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get notification stats: ${errorMessage}`,
        'NotificationService',
      );
      return {
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      };
    }
  }

  /**
   * Format timestamp to human-readable string
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * Rebuild rate limit cache from database
   * Called on module initialization to restore state after restart
   */
  private rebuildRateLimitCache(): void {
    try {
      // Calculate timestamp threshold (current time - rate limit window)
      const rateLimitThreshold = Date.now() - RATE_LIMIT_MINUTES * 60 * 1000;

      // Get last successful notification for each product within rate limit window
      const recentNotifications =
        this.databaseService.getRecentNotifications(rateLimitThreshold);

      // Rebuild cache
      this.notificationCache.clear();
      for (const row of recentNotifications) {
        this.notificationCache.set(row.product_id, row.last_sent);
      }

      this.logger.log(
        `Rate limit cache rebuilt with ${recentNotifications.length} entries`,
        'NotificationService',
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to rebuild rate limit cache: ${errorMessage}`,
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
