import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry, Cron } from '@nestjs/schedule';
import { LoggerService } from '../../common/logger/logger.service';
import { ShopifyService } from '../api/shopify/shopify.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductNormalizer } from '../api/utils/normalizer.util';
import { ProductDto } from '../api/dto/product.dto';
import { IpcGateway } from '../ipc/ipc.gateway';
import { NotificationService } from '../notification/notification.service';
import { DifferService } from '../differ/differ.service';
import { StorageNormalizer } from '../storage/utils/storage-normalizer.util';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly SHOPIFY_URL = 'https://shop.lumenalta.com';
  private isPolling = false;
  private pollIntervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly ipcGateway: IpcGateway,
    private readonly notificationService: NotificationService,
    private readonly differService: DifferService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.logger.log('SchedulerService initialized', 'SchedulerService');
    this.setupPolls();
    // Wire up force-poll handler in IpcGateway
    this.ipcGateway.setSchedulerService(this);
  }

  onModuleDestroy() {
    this.logger.log('SchedulerService shutting down', 'SchedulerService');
    // Clean up the polling interval
    if (this.pollIntervalHandle) {
      clearInterval(this.pollIntervalHandle);
      this.schedulerRegistry.deleteInterval('auto-poll');
      this.pollIntervalHandle = null;
      this.logger.log('Automatic polling stopped', 'SchedulerService');
    }
  }

  /**
   * Setup polling configuration
   * Load active products and configure scheduling
   */
  setupPolls(): void {
    this.logger.log('Setting up automatic polls', 'SchedulerService');

    // Read poll interval in seconds (default: 60 seconds = 1 minute)
    const pollIntervalSeconds =
      this.configService.get<number>('LUMENTUI_POLL_INTERVAL') || 60;

    // Convert to milliseconds
    const pollIntervalMs = pollIntervalSeconds * 1000;

    this.logger.log(
      `Polls configured with interval: ${pollIntervalSeconds} seconds (${pollIntervalMs}ms)`,
      'SchedulerService',
    );

    // Get existing products count for logging
    const products = this.databaseService.getProducts({ limit: 1 });
    this.logger.log(
      `Database contains ${products.length > 0 ? 'existing' : 'no'} products`,
      'SchedulerService',
    );

    // Create dynamic interval for automatic polling
    this.pollIntervalHandle = setInterval(() => {
      this.logger.log('Automatic poll triggered', 'SchedulerService');
      void this.handlePoll();
    }, pollIntervalMs);

    // Register with SchedulerRegistry for management
    this.schedulerRegistry.addInterval('auto-poll', this.pollIntervalHandle);

    this.logger.log(
      `Automatic polling started with ${pollIntervalSeconds}s interval`,
      'SchedulerService',
    );
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
      this.ipcGateway.emitLog('info', 'Fetching products from Shopify...');
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

      // Get existing products and use DifferService to detect new ones
      const existingProductEntities = this.databaseService.getProducts();
      const existingProducts = StorageNormalizer.fromEntities(
        existingProductEntities,
      );
      const { newProducts: newProductList } = this.differService.compare(
        existingProducts,
        productsToSave,
      );
      const newProducts = newProductList.length;

      // Save products to database
      const savedCount = this.databaseService.saveProducts(productsToSave);

      // Emit products updated event
      this.ipcGateway.emitProductsUpdated(productsToSave);

      // Emit individual new product events
      for (const newProduct of newProductList) {
        this.ipcGateway.emitLog('info', `New product: ${newProduct.title}`);
        this.ipcGateway.emitProductNew(newProduct);
      }

      // Send notifications for new products (skip on initial fetch when DB was empty)
      const isInitialFetch = existingProductEntities.length === 0;
      if (isInitialFetch && newProductList.length > 0) {
        this.logger.log(
          `Initial fetch: skipping notifications for ${newProductList.length} products`,
          'SchedulerService',
        );
      } else if (newProductList.length > 0) {
        this.logger.log(
          `Processing notifications for ${newProductList.length} new products`,
          'SchedulerService',
        );

        for (const newProduct of newProductList) {
          try {
            // Check if product should be notified based on filters
            if (this.notificationService.shouldNotify(newProduct)) {
              await this.notificationService.sendAvailabilityNotification(
                newProduct,
              );
            } else {
              this.logger.log(
                `Product ${newProduct.id} filtered out by notification rules`,
              );
            }
          } catch (error) {
            // Log error but don't break the poll flow
            this.logger.error(
              `Failed to send notification for product ${newProduct.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error instanceof Error ? error.stack : undefined,
              'SchedulerService',
            );
          }
        }
      }

      const durationMs = Date.now() - startTime;

      // Record poll metrics
      const pollMetrics = {
        productCount: savedCount,
        newProducts,
        durationMs,
        success: true,
      };

      this.databaseService.recordPoll(pollMetrics);

      this.ipcGateway.emitLog(
        'info',
        `Poll complete: ${savedCount} products, ${newProducts} new (${durationMs}ms)`,
      );

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

      // Emit error to IPC clients
      this.ipcGateway.emitLog('error', `Poll failed: ${errorMessage}`);
      this.ipcGateway.emitError(errorMessage);

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
      // Always emit heartbeat so TUI knows daemon is alive,
      // regardless of poll success/failure
      this.ipcGateway.emitHeartbeat(Date.now());
      this.isPolling = false;
    }
  }

  /**
   * Force an immediate poll, bypassing the cron schedule
   * Respects the existing isPolling flag to prevent concurrent polls
   */
  async forcePoll(): Promise<{
    success: boolean;
    productCount: number;
    newProducts: number;
    durationMs: number;
    error?: string;
  }> {
    this.logger.log('Force poll requested', 'SchedulerService');

    // Check if already polling
    if (this.isPolling) {
      this.logger.warn(
        'Poll already in progress, cannot force poll',
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

    // Execute the poll immediately
    return this.handlePoll();
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

  /**
   * Scheduled cleanup task - runs daily at midnight
   * Prunes old notification history to prevent database bloat
   */
  @Cron('0 0 * * *')
  handleNotificationCleanup(): void {
    try {
      this.logger.log(
        'Starting scheduled notification history cleanup',
        'SchedulerService',
      );

      const deletedCount = this.databaseService.pruneNotificationHistory();

      this.logger.log(
        `Notification history cleanup complete: ${deletedCount} records deleted`,
        'SchedulerService',
      );

      this.ipcGateway.emitLog(
        'info',
        `Cleaned up ${deletedCount} old notification records`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Notification history cleanup failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        'SchedulerService',
      );

      this.ipcGateway.emitLog(
        'error',
        `Notification cleanup failed: ${errorMessage}`,
      );
    }
  }
}
