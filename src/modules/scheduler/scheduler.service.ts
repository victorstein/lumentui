import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../../common/logger/logger.service';
import { ShopifyService } from '../api/shopify/shopify.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductNormalizer } from '../api/utils/normalizer.util';
import { ProductDto } from '../api/dto/product.dto';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly SHOPIFY_URL = 'https://shop.lumenalta.com';
  private isPolling = false;

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    this.logger.log('SchedulerService initialized', 'SchedulerService');
    this.setupPolls();
  }

  /**
   * Setup polling configuration
   * Load active products and configure scheduling
   */
  setupPolls(): void {
    this.logger.log('Setting up automatic polls', 'SchedulerService');

    const pollInterval =
      this.configService.get<string>('POLL_INTERVAL') || '*/30 * * * *';

    this.logger.log(
      `Polls configured with interval: ${pollInterval}`,
      'SchedulerService',
    );

    // Get existing products count for logging
    const products = this.databaseService.getProducts({ limit: 1 });
    this.logger.log(
      `Database contains ${products.length > 0 ? 'existing' : 'no'} products`,
      'SchedulerService',
    );
  }

  /**
   * Automatic poll triggered by cron
   * Runs every 30 minutes by default
   */
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'auto-poll',
  })
  async handleAutomaticPoll(): Promise<void> {
    this.logger.log('Automatic poll triggered', 'SchedulerService');
    await this.handlePoll();
  }

  /**
   * Execute a poll for products
   * Can be called manually or by cron
   */
  async handlePoll(productId?: string): Promise<{
    success: boolean;
    productCount: number;
    newProducts: number;
    durationMs: number;
    error?: string;
  }> {
    // Prevent concurrent polls
    if (this.isPolling) {
      this.logger.warn(
        'Poll already in progress, skipping',
        'SchedulerService',
      );
      return {
        success: false,
        productCount: 0,
        newProducts: 0,
        durationMs: 0,
        error: 'Poll already in progress',
      };
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      this.logger.log(
        productId
          ? `Starting poll for product: ${productId}`
          : 'Starting full poll',
        'SchedulerService',
      );

      // Fetch products from Shopify
      const shopifyProducts = await this.shopifyService.getProducts();

      if (shopifyProducts.length === 0) {
        this.logger.warn(
          'No products fetched from Shopify',
          'SchedulerService',
        );
      }

      // Normalize products
      const normalizedProducts = ProductNormalizer.normalizeAll(
        shopifyProducts,
        this.SHOPIFY_URL,
      );

      // Filter by productId if specified
      let productsToSave: ProductDto[] = normalizedProducts;
      if (productId) {
        productsToSave = normalizedProducts.filter((p) => p.id === productId);
        if (productsToSave.length === 0) {
          throw new Error(`Product with ID ${productId} not found`);
        }
      }

      // Get existing products to detect new ones
      const existingProductIds = new Set(
        this.databaseService.getProducts().map((p) => p.id),
      );

      // Save products to database
      const savedCount = this.databaseService.saveProducts(productsToSave);

      // Count new products
      const newProducts = productsToSave.filter(
        (p) => !existingProductIds.has(p.id),
      ).length;

      const durationMs = Date.now() - startTime;

      // Record poll metrics
      const pollMetrics = {
        productCount: savedCount,
        newProducts,
        durationMs,
        success: true,
      };

      this.databaseService.recordPoll(pollMetrics);

      this.logger.log(
        `Poll completed: ${savedCount} products, ${newProducts} new, ${durationMs}ms`,
        'SchedulerService',
      );

      return {
        success: true,
        productCount: savedCount,
        newProducts,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Poll failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        'SchedulerService',
      );

      // Record failed poll
      this.databaseService.recordPoll({
        productCount: 0,
        newProducts: 0,
        durationMs,
        success: false,
        error: errorMessage,
      });

      return {
        success: false,
        productCount: 0,
        newProducts: 0,
        durationMs,
        error: errorMessage,
      };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Get polling status
   */
  getStatus(): {
    isPolling: boolean;
    lastPoll?: {
      timestamp: number;
      success: boolean;
      productCount: number;
    };
  } {
    const polls = this.databaseService.getPolls(1);
    const lastPoll = polls[0];

    return {
      isPolling: this.isPolling,
      lastPoll: lastPoll
        ? {
            timestamp: lastPoll.timestamp,
            success: lastPoll.success === 1,
            productCount: lastPoll.product_count,
          }
        : undefined,
    };
  }
}
