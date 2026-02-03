/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';
import { ShopifyService } from '../api/shopify/shopify.service';
import { DatabaseService } from '../storage/database/database.service';
import { LoggerService } from '../../common/logger/logger.service';
import { IpcGateway } from '../ipc/ipc.gateway';
import { NotificationService } from '../notification/notification.service';
import { DifferService } from '../differ/differ.service';
import { ShopifyProduct } from '../api/interfaces/shopify.interface';
import { ProductEntity } from '../storage/entities/product.entity';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let shopifyService: jest.Mocked<ShopifyService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;
  let ipcGateway: jest.Mocked<IpcGateway>;
  let notificationService: jest.Mocked<NotificationService>;
  let differService: jest.Mocked<DifferService>;

  // Mock data
  const mockShopifyProducts: ShopifyProduct[] = [
    {
      id: 123456,
      title: 'Test Product',
      handle: 'test-product',
      body_html: '<p>Test description</p>',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      published_at: '2024-01-01T00:00:00Z',
      tags: 'test',
      variants: [
        {
          id: 789,
          product_id: 123456,
          title: 'Default',
          price: '99.99',
          sku: 'TEST-SKU',
          position: 1,
          inventory_policy: 'deny',
          compare_at_price: null,
          fulfillment_service: 'manual',
          inventory_management: 'shopify',
          option1: 'Default',
          option2: null,
          option3: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          taxable: true,
          barcode: null,
          grams: 500,
          image_id: null,
          weight: 500,
          weight_unit: 'g',
          inventory_item_id: 999,
          inventory_quantity: 10,
          old_inventory_quantity: 10,
          requires_shipping: true,
          available: true,
        },
      ],
      images: [
        {
          id: 111,
          product_id: 123456,
          position: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          alt: 'Test image',
          width: 800,
          height: 600,
          src: 'https://example.com/image.jpg',
          variant_ids: [],
        },
      ],
      options: [],
      available: true,
    },
  ];

  const mockExistingProducts: ProductEntity[] = [
    {
      id: '654321',
      title: 'Existing Product',
      handle: 'existing-product',
      price: 49.99,
      available: 1,
      variants: '[]',
      images: '[]',
      description: 'Existing product description',
      url: 'https://shop.lumenalta.com/products/existing-product',
      first_seen_at: Date.now() - 86400000, // 1 day ago
      last_seen_at: Date.now(),
    },
  ];

  beforeEach(async () => {
    // Create mocks
    const mockShopifyService = {
      getProducts: jest.fn(),
    };

    const mockDatabaseService = {
      getProducts: jest.fn(),
      saveProducts: jest.fn(),
      recordPoll: jest.fn(),
      getPolls: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockIpcGateway = {
      emitHeartbeat: jest.fn(),
      emitProductsUpdated: jest.fn(),
      emitProductNew: jest.fn(),
      emitError: jest.fn(),
      emitLog: jest.fn(),
      getStatus: jest.fn(),
      setSchedulerService: jest.fn(),
    };

    const mockNotificationService = {
      shouldNotify: jest.fn(),
      sendAvailabilityNotification: jest.fn(),
      getNotificationHistory: jest.fn(),
      clearRateLimitCache: jest.fn(),
      getRateLimitStatus: jest.fn(),
    };

    const mockDifferService = {
      compare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: ShopifyService,
          useValue: mockShopifyService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: IpcGateway,
          useValue: mockIpcGateway,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: DifferService,
          useValue: mockDifferService,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    shopifyService = module.get(ShopifyService);
    databaseService = module.get(DatabaseService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
    ipcGateway = module.get(IpcGateway);
    notificationService = module.get(NotificationService);
    differService = module.get(DifferService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setupPolls', () => {
    it('should initialize poll configuration', () => {
      configService.get.mockReturnValue('*/30 * * * *');
      databaseService.getProducts.mockReturnValue([]);

      service.setupPolls();

      expect(loggerService.log).toHaveBeenCalledWith(
        'Setting up automatic polls',
        'SchedulerService',
      );
      expect(configService.get).toHaveBeenCalledWith('POLL_INTERVAL');
      expect(databaseService.getProducts).toHaveBeenCalledWith({ limit: 1 });
    });

    it('should use default interval if not configured', () => {
      configService.get.mockReturnValue(undefined);
      databaseService.getProducts.mockReturnValue([]);

      service.setupPolls();

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('*/30 * * * *'),
        'SchedulerService',
      );
    });

    it('should log existing products status', () => {
      configService.get.mockReturnValue('*/30 * * * *');
      databaseService.getProducts.mockReturnValue(mockExistingProducts);

      service.setupPolls();

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('existing'),
        'SchedulerService',
      );
    });
  });

  describe('handlePoll', () => {
    beforeEach(() => {
      // Reset polling state
      (service as any).isPolling = false;
      // Setup default differ mock - tests can override this
      differService.compare.mockReturnValue({
        newProducts: [],
        updatedProducts: [],
      });
    });

    it('should successfully poll and save products', async () => {
      shopifyService.getProducts.mockResolvedValue(mockShopifyProducts);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.saveProducts.mockReturnValue(1);
      databaseService.recordPoll.mockReturnValue(1);
      // Mock differ to return the new product
      differService.compare.mockReturnValue({
        newProducts: [
          {
            id: '123456',
            title: 'Test Product',
            handle: 'test-product',
            url: 'https://shop.lumenalta.com/products/test-product',
            vendor: 'Test Vendor',
            product_type: 'Test Type',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            published_at: '2024-01-01T00:00:00Z',
            status: 'active',
            variants: [],
            images: [],
            tags: [],
            options: [],
          },
        ],
        updatedProducts: [],
      });
      differService.compare.mockReturnValue({
        newProducts: [
          {
            id: '123456',
            title: 'Test Product',
            handle: 'test-product',
            price: 99.99,
            available: true,
            variants: [],
            images: [],
            description: 'Test description',
            url: 'https://shop.lumenalta.com/products/test-product',
          },
        ],
        updatedProducts: [],
      });

      const result = await service.handlePoll();

      expect(result.success).toBe(true);
      expect(result.productCount).toBe(1);
      expect(result.newProducts).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(shopifyService.getProducts).toHaveBeenCalled();
      expect(databaseService.saveProducts).toHaveBeenCalled();
      expect(databaseService.recordPoll).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          productCount: 1,
          newProducts: 1,
        }),
      );

      // Verify IPC events
      expect(ipcGateway.emitProductsUpdated).toHaveBeenCalled();
      expect(ipcGateway.emitProductNew).toHaveBeenCalled();
      expect(ipcGateway.emitHeartbeat).toHaveBeenCalled();
    });

    it('should detect new vs existing products', async () => {
      shopifyService.getProducts.mockResolvedValue(mockShopifyProducts);
      databaseService.getProducts.mockReturnValue(mockExistingProducts);
      databaseService.saveProducts.mockReturnValue(1);
      databaseService.recordPoll.mockReturnValue(1);
      differService.compare.mockReturnValue({
        newProducts: [
          {
            id: '123456',
            title: 'Test Product',
            handle: 'test-product',
            price: 99.99,
            available: true,
            variants: [],
            images: [],
            description: 'Test description',
            url: 'https://shop.lumenalta.com/products/test-product',
          },
        ],
        updatedProducts: [],
      });

      const result = await service.handlePoll();

      expect(result.success).toBe(true);
      expect(result.newProducts).toBe(1); // New product not in existing
    });

    it('should handle poll for specific product', async () => {
      shopifyService.getProducts.mockResolvedValue(mockShopifyProducts);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.saveProducts.mockReturnValue(1);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.handlePoll('123456');

      expect(result.success).toBe(true);
      expect(result.productCount).toBe(1);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('product: 123456'),
        'SchedulerService',
      );
    });

    it('should handle product not found', async () => {
      shopifyService.getProducts.mockResolvedValue(mockShopifyProducts);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.handlePoll('999999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(databaseService.recordPoll).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should handle concurrent poll attempts', async () => {
      // Simulate ongoing poll
      (service as any).isPolling = true;

      const result = await service.handlePoll();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Poll already in progress');
      expect(shopifyService.getProducts).not.toHaveBeenCalled();
    });

    it('should handle Shopify service errors', async () => {
      const error = new Error('Shopify API error');
      shopifyService.getProducts.mockRejectedValue(error);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.handlePoll();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Shopify API error');
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Poll failed'),
        expect.any(String),
        'SchedulerService',
      );
      expect(databaseService.recordPoll).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Shopify API error',
        }),
      );

      // Verify error emitted via IPC
      expect(ipcGateway.emitError).toHaveBeenCalledWith('Shopify API error');
    });

    it('should handle empty product list', async () => {
      shopifyService.getProducts.mockResolvedValue([]);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.saveProducts.mockReturnValue(0);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.handlePoll();

      expect(result.success).toBe(true);
      expect(result.productCount).toBe(0);
      expect(result.newProducts).toBe(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        'No products fetched from Shopify',
        'SchedulerService',
      );
    });

    it('should reset isPolling flag after error', async () => {
      shopifyService.getProducts.mockRejectedValue(new Error('Test error'));
      databaseService.getProducts.mockReturnValue([]);
      databaseService.recordPoll.mockReturnValue(1);

      await service.handlePoll();

      expect((service as any).isPolling).toBe(false);
    });

    it('should measure poll duration accurately', async () => {
      shopifyService.getProducts.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
      );
      databaseService.getProducts.mockReturnValue([]);
      databaseService.saveProducts.mockReturnValue(0);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.handlePoll();

      expect(result.durationMs).toBeGreaterThanOrEqual(45);
      expect(databaseService.recordPoll).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
      );
    });
  });

  describe('forcePoll', () => {
    beforeEach(() => {
      // Reset polling state
      (service as any).isPolling = false;
    });

    it('should call handlePoll when not already polling', async () => {
      shopifyService.getProducts.mockResolvedValue(mockShopifyProducts);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.saveProducts.mockReturnValue(1);
      databaseService.recordPoll.mockReturnValue(1);
      configService.get.mockReturnValue(undefined); // No phone number configured
      differService.compare.mockReturnValue({
        newProducts: [],
        updatedProducts: [],
      });

      // Spy on handlePoll
      const handlePollSpy = jest.spyOn(service, 'handlePoll');

      const result = await service.forcePoll();

      expect(loggerService.log).toHaveBeenCalledWith(
        'Force poll requested',
        'SchedulerService',
      );
      expect(handlePollSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.productCount).toBe(1);
    });

    it('should return early when already polling', async () => {
      // Simulate ongoing poll
      (service as any).isPolling = true;

      const result = await service.forcePoll();

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Poll already in progress, cannot force poll',
        'SchedulerService',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Poll already in progress');
      expect(shopifyService.getProducts).not.toHaveBeenCalled();
    });

    it('should handle errors during force poll', async () => {
      const error = new Error('Force poll error');
      shopifyService.getProducts.mockRejectedValue(error);
      databaseService.getProducts.mockReturnValue([]);
      databaseService.recordPoll.mockReturnValue(1);

      const result = await service.forcePoll();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Force poll error');
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return polling status without last poll', () => {
      databaseService.getPolls.mockReturnValue([]);

      const status = service.getStatus();

      expect(status.isPolling).toBe(false);
      expect(status.lastPoll).toBeUndefined();
      expect(databaseService.getPolls).toHaveBeenCalledWith(1);
    });

    it('should return polling status with last poll', () => {
      const mockPoll = {
        id: 1,
        timestamp: Date.now(),
        product_count: 10,
        new_products: 2,
        duration_ms: 1500,
        success: 1,
        error: null,
      };

      databaseService.getPolls.mockReturnValue([mockPoll]);

      const status = service.getStatus();

      expect(status.isPolling).toBe(false);
      expect(status.lastPoll).toEqual({
        timestamp: mockPoll.timestamp,
        success: true,
        productCount: mockPoll.product_count,
      });
    });

    it('should reflect current polling state', () => {
      (service as any).isPolling = true;
      databaseService.getPolls.mockReturnValue([]);

      const status = service.getStatus();

      expect(status.isPolling).toBe(true);
    });
  });
});
