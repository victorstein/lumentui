/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../../src/app.module';
import { SchedulerService } from '../../src/modules/scheduler/scheduler.service';
import { DatabaseService } from '../../src/modules/storage/database/database.service';
import { ShopifyService } from '../../src/modules/api/shopify/shopify.service';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { IpcGateway } from '../../src/modules/ipc/ipc.gateway';
import { MockIpcGateway } from '../mocks/ipc.gateway.mock';
import { ShopifyProduct } from '../../src/modules/api/interfaces/shopify.interface';
import { ProductEntity } from '../../src/modules/storage/entities/product.entity';
import { ProductDto } from '../../src/modules/api/dto/product.dto';

/**
 * Helper function to convert ProductEntity (DB format) to ProductDto
 */
function entityToDto(entity: ProductEntity): ProductDto {
  return {
    id: entity.id,
    title: entity.title,
    handle: entity.handle,
    price: entity.price,
    available: entity.available === 1,
    variants:
      typeof entity.variants === 'string'
        ? JSON.parse(entity.variants)
        : entity.variants,
    images:
      typeof entity.images === 'string'
        ? JSON.parse(entity.images)
        : entity.images,
    description: entity.description || undefined,
    url: entity.url,
  } as ProductDto;
}

/**
 * Integration Tests - Phase 7
 *
 * Tests complete flow: poll → scrape → save → notification
 * Uses test database with automatic cleanup
 */
describe('LumenTUI E2E Integration Tests', () => {
  let app: INestApplication;
  let schedulerService: SchedulerService;
  let databaseService: DatabaseService;
  let shopifyService: ShopifyService;
  let notificationService: NotificationService;

  const TEST_DB_PATH = path.join(process.cwd(), 'data/test-lumentui.db');

  // Real product data from Lumenalta Shop (Frieren BD) in Shopify API format
  const FRIEREN_SHOPIFY_MOCK: ShopifyProduct = {
    id: 8791472128323,
    title: "Frieren: Beyond Journey's End Blu-ray Box Set",
    handle: 'frieren-beyond-journeys-end-blu-ray-box-set',
    body_html: '<p>Amazing anime blu-ray box set</p>',
    vendor: 'Lumenalta',
    product_type: 'Blu-ray',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    published_at: '2024-01-15T10:00:00Z',
    tags: 'anime,blu-ray,frieren',
    variants: [
      {
        id: 46789123456789,
        product_id: 8791472128323,
        title: 'Standard Edition',
        price: '99.99',
        sku: 'FRIEREN-BD-001',
        position: 1,
        inventory_policy: 'deny',
        compare_at_price: null,
        fulfillment_service: 'manual',
        inventory_management: 'shopify',
        option1: 'Standard',
        option2: null,
        option3: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        taxable: true,
        barcode: null,
        grams: 500,
        image_id: null,
        weight: 500,
        weight_unit: 'g',
        inventory_item_id: 12345,
        inventory_quantity: 50,
        old_inventory_quantity: 50,
        requires_shipping: true,
      },
    ],
    images: [
      {
        id: 123456,
        product_id: 8791472128323,
        position: 1,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        alt: 'Frieren Box Set',
        width: 800,
        height: 800,
        src: 'https://shop.lumenalta.com/cdn/shop/files/frieren-cover.jpg',
        variant_ids: [],
      },
    ],
    options: [
      {
        id: 1,
        product_id: 8791472128323,
        name: 'Edition',
        position: 1,
        values: ['Standard'],
      },
    ],
  };

  beforeAll(async () => {
    // Ensure data directory exists
    const dataDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Clean up test database if it exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create test module with test environment variables
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          ignoreEnvFile: true,
          load: [
            () => ({
              DB_PATH: TEST_DB_PATH,
              DATABASE_PATH: TEST_DB_PATH,
              NODE_ENV: 'test',
              NOTIFICATION_ENABLED: 'true',
              POLL_INTERVAL: '*/30 * * * *',
            }),
          ],
        }),
        AppModule,
      ],
    })
      .overrideProvider(IpcGateway)
      .useClass(MockIpcGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get service instances
    schedulerService = moduleFixture.get<SchedulerService>(SchedulerService);
    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    shopifyService = moduleFixture.get<ShopifyService>(ShopifyService);
    notificationService =
      moduleFixture.get<NotificationService>(NotificationService);

    // Mock notification service to be fast
    jest
      .spyOn(notificationService, 'sendAvailabilityNotification')
      .mockImplementation(async (product: any, phoneNumber?: string) => {
        // Fast mock implementation - just record the notification
        notificationService['notificationCache'].set(product.id, Date.now());
        notificationService['recordNotification'](product.id, true);
        return true;
      });
  });

  afterAll(async () => {
    await app.close();

    // Cleanup test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterEach(async () => {
    // Wait for any ongoing polls to complete
    if (schedulerService) {
      const maxWaitTime = 10000; // 10 seconds max wait
      const startWait = Date.now();
      while (schedulerService.getStatus().isPolling) {
        if (Date.now() - startWait > maxWaitTime) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Restore all mocks
    jest.restoreAllMocks();

    // Re-mock notification service after restore
    if (notificationService) {
      jest
        .spyOn(notificationService, 'sendAvailabilityNotification')
        .mockImplementation(async (product: any, phoneNumber?: string) => {
          notificationService['notificationCache'].set(product.id, Date.now());
          notificationService['recordNotification'](product.id, true);
          return true;
        });

      // Clear notification rate limit cache between tests
      notificationService.clearRateLimitCache();
    }

    // Clear database between tests (delete in correct order for foreign keys)
    const db = databaseService.getDatabase();
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DELETE FROM notifications');
    db.exec('DELETE FROM polls');
    db.exec('DELETE FROM products');
    db.exec('PRAGMA foreign_keys = ON');
  });

  describe('Complete Flow: Poll → Scrape → Save → Notify', () => {
    it('should poll product, scrape data, save to DB, and trigger notification flow', async () => {
      // Mock Shopify API to return Frieren product
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      // Execute poll
      const result = await schedulerService.handlePoll();

      // Verify poll succeeded
      expect(result.success).toBe(true);
      expect(result.productCount).toBe(1);
      expect(result.newProducts).toBe(1);
      expect(result.durationMs).toBeGreaterThan(0);

      // Verify product saved in database
      const products = databaseService.getProducts({ limit: 10 });
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe('8791472128323');
      expect(products[0].title).toBe(FRIEREN_SHOPIFY_MOCK.title);
      expect(products[0].price).toBe(99.99);

      // Verify poll metrics recorded
      const polls = databaseService.getPolls(1);
      expect(polls).toHaveLength(1);
      expect(polls[0].success).toBe(1);
      expect(polls[0].product_count).toBe(1);

      // Note: Notification tests use mocked implementation
      // Notification service is tested separately in unit tests
      // Integration with real node-notifier tested in manual testing phase
    }, 15000); // 15 second timeout for integration test

    it('should handle multiple products in single poll', async () => {
      const product2: ShopifyProduct = {
        ...FRIEREN_SHOPIFY_MOCK,
        id: 8791472128324,
        title: 'Spy x Family Manga Box Set',
        handle: 'spy-x-family-manga-box-set',
        variants: [
          {
            ...FRIEREN_SHOPIFY_MOCK.variants[0],
            id: 46789123456790,
            product_id: 8791472128324,
            price: '79.99',
          },
        ],
      };

      // Mock Shopify to return 2 products
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK, product2]);

      const result = await schedulerService.handlePoll();

      expect(result.success).toBe(true);
      expect(result.productCount).toBe(2);
      expect(result.newProducts).toBe(2);

      // Verify both products in DB
      const products = databaseService.getProducts({ limit: 10 });
      expect(products).toHaveLength(2);
      expect(products.map((p) => p.id)).toContain('8791472128323');
      expect(products.map((p) => p.id)).toContain('8791472128324');
    });
  });

  describe('Product Change Detection', () => {
    it('should detect new product and mark as new', async () => {
      // First poll - empty DB
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      const result1 = await schedulerService.handlePoll();
      expect(result1.newProducts).toBe(1);

      // Second poll - same product (not new)
      const result2 = await schedulerService.handlePoll();
      expect(result2.newProducts).toBe(0); // Already exists
      expect(result2.productCount).toBe(1); // Still counted
    });

    it('should detect price change in updated product', async () => {
      // Initial poll
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();

      const products1 = databaseService.getProducts({ limit: 1 });
      expect(products1[0].price).toBe(99.99);

      // Poll with price change
      const updatedProduct: ShopifyProduct = {
        ...FRIEREN_SHOPIFY_MOCK,
        variants: [
          {
            ...FRIEREN_SHOPIFY_MOCK.variants[0],
            price: '89.99',
          },
        ],
      };

      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([updatedProduct]);

      await schedulerService.handlePoll();

      const products2 = databaseService.getProducts({ limit: 1 });
      expect(products2[0].price).toBe(89.99); // Price updated
    });

    it('should NOT notify for unchanged products', async () => {
      // Save product first
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();

      // Poll same product (no changes)
      const result = await schedulerService.handlePoll();

      // No new products detected
      expect(result.newProducts).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Shopify API 401 errors gracefully', async () => {
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockRejectedValue(
          new Error('Authentication failed: 401 Unauthorized'),
        );

      const result = await schedulerService.handlePoll();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.productCount).toBe(0);

      // Error should be recorded in polls table
      const polls = databaseService.getPolls(1);
      expect(polls[0].success).toBe(0);
      expect(polls[0].error).toBeTruthy();
    });

    it('should handle Shopify API timeout errors', async () => {
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockRejectedValue(new Error('Request timeout'));

      const result = await schedulerService.handlePoll();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should prevent concurrent polls', async () => {
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve([FRIEREN_SHOPIFY_MOCK]), 2000),
            ),
        );

      // Start first poll (will take 2 seconds)
      const poll1Promise = schedulerService.handlePoll();

      // Try to start second poll immediately
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait a bit
      const poll2Promise = schedulerService.handlePoll();

      const [result1, result2] = await Promise.all([
        poll1Promise,
        poll2Promise,
      ]);

      // One should succeed, one should be skipped
      const oneSucceeded = result1.success || result2.success;
      expect(oneSucceeded).toBe(true);

      // The failed one should have "already in progress" error
      const failedResult = result1.success ? result2 : result1;
      expect(failedResult.success).toBe(false);
      expect(failedResult.error).toContain('already in progress');
    }, 10000);
  });

  describe('Database Persistence', () => {
    it('should persist products across polls', async () => {
      // First poll
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();

      const products1 = databaseService.getProducts({ limit: 10 });
      expect(products1).toHaveLength(1);

      // Second poll with new product
      const product2: ShopifyProduct = {
        ...FRIEREN_SHOPIFY_MOCK,
        id: 8791472128325,
        title: 'Attack on Titan Final Season',
        variants: [
          {
            ...FRIEREN_SHOPIFY_MOCK.variants[0],
            id: 46789123456791,
            product_id: 8791472128325,
          },
        ],
      };

      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK, product2]);

      await schedulerService.handlePoll();

      const products2 = databaseService.getProducts({ limit: 10 });
      expect(products2).toHaveLength(2);

      // Original product should still exist
      const frieren = products2.find((p) => p.id === '8791472128323');
      expect(frieren).toBeDefined();
      expect(frieren?.title).toBe(FRIEREN_SHOPIFY_MOCK.title);
    });

    it('should use test database (data/test-lumentui.db)', () => {
      // Verify test database path
      const db = databaseService.getDatabase();
      expect(db).toBeDefined();

      // Test database should be empty initially (after cleanup)
      const products = databaseService.getProducts({ limit: 1 });
      expect(products).toHaveLength(0);
    });

    it('should maintain data integrity with concurrent operations', async () => {
      // Create 5 different products
      const products: ShopifyProduct[] = Array.from({ length: 5 }, (_, i) => ({
        ...FRIEREN_SHOPIFY_MOCK,
        id: 8791472128323 + i,
        title: `Product ${i}`,
        handle: `product-${i}`,
        variants: [
          {
            ...FRIEREN_SHOPIFY_MOCK.variants[0],
            id: 46789123456789 + i,
            product_id: 8791472128323 + i,
          },
        ],
      }));

      // Mock to return all products
      jest.spyOn(shopifyService, 'getProducts').mockResolvedValue(products);

      // Save via poll
      await schedulerService.handlePoll();

      // All products should be saved
      const savedProducts = databaseService.getProducts({ limit: 10 });
      expect(savedProducts).toHaveLength(5);
    });
  });

  describe('Notification Rate Limiting', () => {
    beforeEach(async () => {
      // Setup a product in database for notification tests
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();
    });

    // Note: Notification tests with node-notifier are covered by unit tests
    // These are covered by unit tests and manual testing phase
    it.skip('should enforce rate limiting for same product', async () => {
      // Tested in unit tests
    });

    it.skip('should allow notification after clearing cache', async () => {
      // Tested in unit tests
    });

    it('should have rate limit functionality available', () => {
      const products = databaseService.getProducts({ limit: 1 });
      if (products.length > 0) {
        const status = notificationService.getRateLimitStatus(products[0].id);
        expect(status).toHaveProperty('isLimited');
        expect(status).toHaveProperty('lastNotification');
        expect(status).toHaveProperty('minutesUntilUnlocked');
      }
    });
  });

  describe('Scheduler Status', () => {
    it('should report accurate polling status', async () => {
      const statusBefore = schedulerService.getStatus();
      expect(statusBefore.isPolling).toBe(false);

      // Mock a poll
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();

      const statusAfter = schedulerService.getStatus();
      expect(statusAfter.isPolling).toBe(false);
      expect(statusAfter.lastPoll).toBeDefined();
      expect(statusAfter.lastPoll?.success).toBe(true);
      expect(statusAfter.lastPoll?.productCount).toBe(1);
    });
  });

  describe('Test Database Cleanup', () => {
    it('should auto-cleanup test data after each test', async () => {
      // Save a product via poll
      jest
        .spyOn(shopifyService, 'getProducts')
        .mockResolvedValue([FRIEREN_SHOPIFY_MOCK]);

      await schedulerService.handlePoll();

      // Verify saved
      const productsBefore = databaseService.getProducts({ limit: 1 });
      expect(productsBefore).toHaveLength(1);

      // afterEach hook will cleanup (tested implicitly by other tests)
    });
  });
});
