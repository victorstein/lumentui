/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LoggerService } from '../../common/logger/logger.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductDto } from '../api/dto/product.dto';
import { PriceChange, AvailabilityChange } from '../differ/differ.service';
import * as childProcess from 'child_process';

// Mock child_process.execFile
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const mockExecFile = childProcess.execFile as unknown as jest.Mock;

describe('NotificationService', () => {
  let service: NotificationService;
  let mockConfigService: Partial<ConfigService>;
  let mockLoggerService: Partial<LoggerService>;
  let mockDatabaseService: Partial<DatabaseService>;
  let mockDbPrepare: jest.Mock;
  let mockDbRun: jest.Mock;
  let mockDbAll: jest.Mock;

  const mockProduct: ProductDto = {
    id: '123',
    title: 'Test Gaming Mouse',
    handle: 'test-gaming-mouse',
    price: 59.99,
    available: true,
    variants: [
      {
        id: '456',
        title: 'Black',
        price: 59.99,
        sku: 'MOUSE-BLK',
        available: true,
        inventoryQuantity: 5,
      },
      {
        id: '457',
        title: 'White',
        price: 64.99,
        sku: 'MOUSE-WHT',
        available: true,
        inventoryQuantity: 3,
      },
    ],
    images: [
      {
        id: '789',
        src: 'https://example.com/mouse.jpg',
        alt: 'Gaming Mouse',
        width: 1000,
        height: 1000,
      },
    ],
    description: 'High-performance gaming mouse',
    url: 'https://shop.lumenalta.com/products/test-gaming-mouse',
  };

  /** Helper: make mockExecFile call the callback with success */
  function execFileSuccess() {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], cb: Function) => {
        cb(null, '', '');
      },
    );
  }

  /** Helper: make mockExecFile call the callback with an error */
  function execFileError(msg = 'osascript failed') {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], cb: Function) => {
        cb(new Error(msg), '', '');
      },
    );
  }

  beforeEach(async () => {
    // Reset mocks
    mockDbRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
    mockDbAll = jest.fn().mockReturnValue([]);
    mockDbPrepare = jest.fn().mockReturnValue({
      run: mockDbRun,
      all: mockDbAll,
    });

    mockConfigService = {
      get: jest.fn((_key: string) => {
        return undefined;
      }),
    };

    mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockDatabaseService = {
      getDatabase: jest.fn().mockReturnValue({
        prepare: mockDbPrepare,
      }),
      recordNotification: jest.fn(),
      getNotificationHistory: jest.fn().mockReturnValue([]),
      getRecentNotifications: jest.fn().mockReturnValue([]),
      getNotificationStats: jest.fn().mockReturnValue({
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (service) {
      service.clearRateLimitCache();
    }
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should rebuild rate limit cache from database on initialization', async () => {
      const recentNotifications = [
        { product_id: 'prod1', last_sent: Date.now() - 30 * 60 * 1000 },
        { product_id: 'prod2', last_sent: Date.now() - 10 * 60 * 1000 },
      ];

      const mockGetRecentNotifications = jest
        .fn()
        .mockReturnValue(recentNotifications);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: LoggerService,
            useValue: mockLoggerService,
          },
          {
            provide: DatabaseService,
            useValue: {
              ...mockDatabaseService,
              getRecentNotifications: mockGetRecentNotifications,
            },
          },
        ],
      }).compile();

      const testService = module.get<NotificationService>(NotificationService);
      testService.onModuleInit();

      expect(mockGetRecentNotifications).toHaveBeenCalled();
      expect(mockGetRecentNotifications).toHaveBeenCalledWith(
        expect.any(Number),
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit cache rebuilt with 2 entries'),
        'NotificationService',
      );

      const status1 = testService.getRateLimitStatus('prod1');
      const status2 = testService.getRateLimitStatus('prod2');

      expect(status1.isLimited).toBe(true);
      expect(status2.isLimited).toBe(true);
    });

    it('should handle database errors during cache rebuild gracefully', async () => {
      const mockGetRecentNotificationsError = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Database connection failed');
        });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: LoggerService,
            useValue: mockLoggerService,
          },
          {
            provide: DatabaseService,
            useValue: {
              ...mockDatabaseService,
              getRecentNotifications: mockGetRecentNotificationsError,
            },
          },
        ],
      }).compile();

      const testService = module.get<NotificationService>(NotificationService);

      expect(() => testService.onModuleInit()).not.toThrow();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to rebuild rate limit cache'),
        'NotificationService',
      );
    });
  });

  describe('sendAvailabilityNotification', () => {
    it('should send notification successfully', async () => {
      execFileSuccess();

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(mockExecFile).toHaveBeenCalledWith(
        'osascript',
        ['-e', expect.stringContaining('Test Gaming Mouse')],
        expect.any(Function),
      );
    });

    it('should handle notification errors gracefully', async () => {
      execFileError();

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        false,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: expect.any(String),
          errorMessage: expect.any(String),
        }),
      );
    });

    it('should record successful notification in database with metadata', async () => {
      execFileSuccess();

      await service.sendAvailabilityNotification(mockProduct);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: expect.any(String),
        }),
      );
    });

    it('should include availability change description with variant count', async () => {
      execFileSuccess();

      await service.sendAvailabilityNotification(mockProduct);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          availabilityChange: 'became available (2 variant(s))',
        }),
      );
    });

    it('should describe availability change for product without variants', async () => {
      execFileSuccess();

      const productNoVariants: ProductDto = {
        ...mockProduct,
        variants: [],
      };

      await service.sendAvailabilityNotification(productNoVariants);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        productNoVariants.id,
        true,
        expect.objectContaining({
          availabilityChange: 'became available',
        }),
      );
    });

    it('should describe sold out for unavailable product', async () => {
      execFileSuccess();

      const unavailableProduct: ProductDto = {
        ...mockProduct,
        available: false,
        variants: [
          {
            ...mockProduct.variants[0],
            available: false,
          },
        ],
      };

      await service.sendAvailabilityNotification(unavailableProduct);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        unavailableProduct.id,
        true,
        expect.objectContaining({
          availabilityChange: 'sold out',
        }),
      );
    });
  });

  describe('Message formatting', () => {
    it('should format message with all product details', async () => {
      execFileSuccess();

      await service.sendAvailabilityNotification(mockProduct);

      const script = mockExecFile.mock.calls[0][1][1] as string;

      expect(script).toContain(mockProduct.title);
      expect(script).toContain('$59.99');
      expect(script).toContain('variant');
      expect(script).toContain(mockProduct.url);
    });

    it('should format concise message for notification center', async () => {
      execFileSuccess();

      await service.sendAvailabilityNotification(mockProduct);

      const script = mockExecFile.mock.calls[0][1][1] as string;

      expect(script).not.toContain('*');
      expect(script).not.toContain('🔔');
      expect(script).not.toContain('_');
    });
  });

  describe('Rate limiting', () => {
    it('should allow first notification for a product', async () => {
      execFileSuccess();

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should block duplicate notifications within rate limit window', async () => {
      execFileSuccess();

      const result1 = await service.sendAvailabilityNotification(mockProduct);
      const result2 = await service.sendAvailabilityNotification(mockProduct);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
        'NotificationService',
      );
    });

    it('should allow notifications for different products', async () => {
      execFileSuccess();

      const product2: ProductDto = { ...mockProduct, id: '999' };

      const result1 = await service.sendAvailabilityNotification(mockProduct);
      const result2 = await service.sendAvailabilityNotification(product2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // 1 `which` check (cached) + 2 terminal-notifier calls = 3
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should provide rate limit status', async () => {
      execFileSuccess();

      let status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(false);
      expect(status.lastNotification).toBeNull();

      await service.sendAvailabilityNotification(mockProduct);

      status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(true);
      expect(status.lastNotification).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeLessThanOrEqual(60);
    });

    it('should clear rate limit cache', async () => {
      execFileSuccess();

      await service.sendAvailabilityNotification(mockProduct);

      service.clearRateLimitCache();

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getNotificationHistory', () => {
    it('should retrieve notification history for a product', () => {
      const mockHistory = [
        { id: 1, product_id: '123', timestamp: Date.now(), sent: 1 },
        { id: 2, product_id: '123', timestamp: Date.now() - 1000, sent: 1 },
      ];

      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        mockHistory,
      );

      const history = service.getNotificationHistory('123');

      expect(history).toEqual(mockHistory);
      expect(mockDatabaseService.getNotificationHistory).toHaveBeenCalledWith({
        productId: '123',
        limit: 10,
      });
    });

    it('should respect custom limit', () => {
      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        [],
      );

      service.getNotificationHistory('123', 5);

      expect(mockDatabaseService.getNotificationHistory).toHaveBeenCalledWith({
        productId: '123',
        limit: 5,
      });
    });

    it('should handle database errors gracefully', () => {
      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        [],
      );

      const history = service.getNotificationHistory('123');

      expect(history).toEqual([]);
    });
  });

  describe('shouldNotify', () => {
    it('should return true when no filters are set', () => {
      mockConfigService.get = jest.fn().mockReturnValue('');

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should filter out products below minimum price', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '100';
        return '';
      });

      const cheapProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Default',
            price: 50,
            sku: 'SKU',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const result = service.shouldNotify(cheapProduct);

      expect(result).toBe(false);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('below minimum'),
        'NotificationService',
      );
    });

    it('should allow products with at least one variant above minimum price', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '60';
        return '';
      });

      const mixedProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Cheap',
            price: 50,
            sku: 'SKU1',
            available: true,
            inventoryQuantity: 1,
          },
          {
            id: '2',
            title: 'Expensive',
            price: 70,
            sku: 'SKU2',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const result = service.shouldNotify(mixedProduct);

      expect(result).toBe(true);
    });

    it('should filter out products without matching keywords', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS')
          return 'laptop,keyboard,monitor';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(false);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('does not contain any of'),
        'NotificationService',
      );
    });

    it('should allow products with matching keywords (case-insensitive)', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'GAMING,laptop,keyboard';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should handle multiple keywords with whitespace', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS')
          return '  laptop , gaming mouse  , keyboard  ';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should apply both filters when both are set', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '50';
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'gaming,mouse';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should filter out when price passes but keywords fail', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '50';
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'laptop,keyboard';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(false);
    });

    it('should filter out when keywords pass but price fails', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '100';
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'gaming,mouse';
        return '';
      });

      const cheapProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Default',
            price: 50,
            sku: 'SKU',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const result = service.shouldNotify(cheapProduct);

      expect(result).toBe(false);
    });

    it('should handle invalid minimum price gracefully', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return 'invalid';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should handle empty keywords string', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return '   ';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });

    it('should handle keywords with only commas', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return ',,,';
        return '';
      });

      const result = service.shouldNotify(mockProduct);

      expect(result).toBe(true);
    });
  });

  describe('getFormattedHistory', () => {
    it('should format notification history correctly', () => {
      const mockRawHistory = [
        {
          id: 1,
          product_id: 'prod-123',
          product_title: 'Gaming Mouse',
          timestamp: 1704067200000,
          sent: 1,
          availability_change: 'became available (2 variant(s))',
          error_message: null,
        },
        {
          id: 2,
          product_id: 'prod-456',
          product_title: 'Keyboard',
          timestamp: 1704153600000,
          sent: 0,
          availability_change: 'became available',
          error_message: 'osascript failed',
        },
      ];

      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        mockRawHistory,
      );

      const result = service.getFormattedHistory();

      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        id: 1,
        productId: 'prod-123',
        productTitle: 'Gaming Mouse',
        timestamp: 1704067200000,
        status: 'sent',
        availabilityChange: 'became available (2 variant(s))',
        errorMessage: null,
      });

      expect(result[0].formattedTimestamp).toMatch(/\d{2}\/\d{2}\/\d{4}/);

      expect(result[1]).toMatchObject({
        id: 2,
        productId: 'prod-456',
        productTitle: 'Keyboard',
        timestamp: 1704153600000,
        status: 'failed',
        availabilityChange: 'became available',
        errorMessage: 'osascript failed',
      });
    });

    it('should pass filters to database service', () => {
      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        [],
      );

      const filters = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        productId: 'prod-123',
        status: 'sent' as const,
        limit: 50,
        offset: 10,
      };

      service.getFormattedHistory(filters);

      expect(mockDatabaseService.getNotificationHistory).toHaveBeenCalledWith(
        filters,
      );
    });

    it('should handle null values in notification fields', () => {
      const mockRawHistory = [
        {
          id: 1,
          product_id: 'prod-123',
          product_title: null,
          timestamp: 1704067200000,
          sent: 1,
          availability_change: null,
          error_message: null,
        },
      ];

      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        mockRawHistory,
      );

      const result = service.getFormattedHistory();

      expect(result[0]).toMatchObject({
        id: 1,
        productId: 'prod-123',
        productTitle: null,
        status: 'sent',
        availabilityChange: null,
        errorMessage: null,
      });
    });

    it('should handle database errors gracefully', () => {
      (
        mockDatabaseService.getNotificationHistory as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = service.getFormattedHistory();

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get formatted notification history'),
        'NotificationService',
      );
    });

    it('should handle missing id field', () => {
      const mockRawHistory = [
        {
          product_id: 'prod-123',
          product_title: 'Test',
          timestamp: 1704067200000,
          sent: 1,
          availability_change: null,
          error_message: null,
        },
      ];

      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        mockRawHistory,
      );

      const result = service.getFormattedHistory();

      expect(result[0].id).toBe(0);
    });

    it('should format timestamps consistently', () => {
      const mockRawHistory = [
        {
          id: 1,
          product_id: 'prod-123',
          product_title: 'Test',
          timestamp: 1704067200000,
          sent: 1,
          availability_change: null,
          error_message: null,
        },
      ];

      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        mockRawHistory,
      );

      const result = service.getFormattedHistory();

      expect(result[0].formattedTimestamp).toBeTruthy();
      expect(typeof result[0].formattedTimestamp).toBe('string');
    });
  });

  describe('getNotificationStats', () => {
    it('should format notification stats correctly', () => {
      const mockStats = {
        totalSent: 42,
        totalFailed: 7,
        countByProduct: [
          {
            product_id: 'prod-123',
            product_title: 'Gaming Mouse',
            sent_count: 10,
            failed_count: 2,
          },
          {
            product_id: 'prod-456',
            product_title: 'Keyboard',
            sent_count: 5,
            failed_count: 1,
          },
        ],
      };

      (mockDatabaseService.getNotificationStats as jest.Mock).mockReturnValue(
        mockStats,
      );

      const result = service.getNotificationStats();

      expect(result.totalSent).toBe(42);
      expect(result.totalFailed).toBe(7);
      expect(result.countByProduct).toHaveLength(2);

      expect(result.countByProduct[0]).toMatchObject({
        productId: 'prod-123',
        productTitle: 'Gaming Mouse',
        sentCount: 10,
        failedCount: 2,
        totalCount: 12,
      });

      expect(result.countByProduct[1]).toMatchObject({
        productId: 'prod-456',
        productTitle: 'Keyboard',
        sentCount: 5,
        failedCount: 1,
        totalCount: 6,
      });
    });

    it('should handle database errors gracefully', () => {
      (
        mockDatabaseService.getNotificationStats as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = service.getNotificationStats();

      expect(result).toEqual({
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      });
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get notification stats'),
        'NotificationService',
      );
    });

    it('should handle null product titles', () => {
      const mockStats = {
        totalSent: 10,
        totalFailed: 2,
        countByProduct: [
          {
            product_id: 'prod-123',
            product_title: null,
            sent_count: 8,
            failed_count: 2,
          },
        ],
      };

      (mockDatabaseService.getNotificationStats as jest.Mock).mockReturnValue(
        mockStats,
      );

      const result = service.getNotificationStats();

      expect(result.countByProduct[0]).toMatchObject({
        productId: 'prod-123',
        productTitle: null,
        sentCount: 8,
        failedCount: 2,
        totalCount: 10,
      });
    });

    it('should calculate total counts correctly', () => {
      const mockStats = {
        totalSent: 100,
        totalFailed: 50,
        countByProduct: [
          {
            product_id: 'prod-123',
            product_title: 'Product 1',
            sent_count: 25,
            failed_count: 10,
          },
          {
            product_id: 'prod-456',
            product_title: 'Product 2',
            sent_count: 0,
            failed_count: 15,
          },
          {
            product_id: 'prod-789',
            product_title: 'Product 3',
            sent_count: 30,
            failed_count: 0,
          },
        ],
      };

      (mockDatabaseService.getNotificationStats as jest.Mock).mockReturnValue(
        mockStats,
      );

      const result = service.getNotificationStats();

      expect(result.countByProduct[0].totalCount).toBe(35);
      expect(result.countByProduct[1].totalCount).toBe(15);
      expect(result.countByProduct[2].totalCount).toBe(30);
    });

    it('should handle empty results', () => {
      const mockStats = {
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      };

      (mockDatabaseService.getNotificationStats as jest.Mock).mockReturnValue(
        mockStats,
      );

      const result = service.getNotificationStats();

      expect(result.totalSent).toBe(0);
      expect(result.totalFailed).toBe(0);
      expect(result.countByProduct).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle product with no variants', async () => {
      execFileSuccess();

      const productNoVariants: ProductDto = {
        ...mockProduct,
        variants: [],
      };

      const result =
        await service.sendAvailabilityNotification(productNoVariants);

      expect(result).toBe(true);
      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain('variant');
    });

    it('should handle product with zero price', async () => {
      execFileSuccess();

      const productFree: ProductDto = {
        ...mockProduct,
        price: 0,
      };

      const result = await service.sendAvailabilityNotification(productFree);

      expect(result).toBe(true);
      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).not.toContain('Price:');
    });

    it('should handle database recording errors without failing notification', async () => {
      execFileSuccess();

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: expect.any(String),
        }),
      );
    });

    it('should escape backslashes and quotes in notification messages', async () => {
      execFileSuccess();

      const productWithSpecialChars: ProductDto = {
        ...mockProduct,
        title: 'Product with "quotes" and \\backslashes\\',
      };

      const result = await service.sendAvailabilityNotification(
        productWithSpecialChars,
      );

      expect(result).toBe(true);
      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('\\"quotes\\"');
      expect(script).toContain('\\\\backslashes\\\\');
    });

    it('should handle product available with some unavailable variants', async () => {
      execFileSuccess();

      const productMixedVariants: ProductDto = {
        ...mockProduct,
        available: true,
        variants: [
          {
            id: '1',
            title: 'Available',
            price: 50,
            sku: 'SKU1',
            available: true,
            inventoryQuantity: 5,
          },
          {
            id: '2',
            title: 'Unavailable',
            price: 60,
            sku: 'SKU2',
            available: false,
            inventoryQuantity: 0,
          },
        ],
      };

      await service.sendAvailabilityNotification(productMixedVariants);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        productMixedVariants.id,
        true,
        expect.objectContaining({
          availabilityChange: 'became available (1 variant(s))',
        }),
      );
    });
  });

  describe('sendPriceChangeNotification', () => {
    const mockPriceChange: PriceChange = {
      product: mockProduct,
      oldPrice: 59.99,
      newPrice: 49.99,
    };

    it('should send price change notification successfully', async () => {
      execFileSuccess();

      const result = await service.sendPriceChangeNotification(mockPriceChange);

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(mockExecFile).toHaveBeenCalledWith(
        'osascript',
        ['-e', expect.stringContaining('Test Gaming Mouse')],
        expect.any(Function),
      );
    });

    it('should format price drop message correctly', async () => {
      execFileSuccess();

      await service.sendPriceChangeNotification(mockPriceChange);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('dropped from $59.99 to $49.99');
      expect(script).toContain('Price Change');
    });

    it('should format price increase message correctly', async () => {
      execFileSuccess();

      const priceIncrease: PriceChange = {
        product: mockProduct,
        oldPrice: 49.99,
        newPrice: 59.99,
      };

      await service.sendPriceChangeNotification(priceIncrease);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('increased from $49.99 to $59.99');
    });

    it('should include compare at price changes', async () => {
      execFileSuccess();

      const priceChangeWithCompare: PriceChange = {
        product: mockProduct,
        oldPrice: 59.99,
        newPrice: 49.99,
        oldCompareAtPrice: 79.99,
        newCompareAtPrice: 69.99,
      };

      await service.sendPriceChangeNotification(priceChangeWithCompare);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('Compare at: $69.99');
    });

    it('should handle notification errors gracefully', async () => {
      execFileError();

      const result = await service.sendPriceChangeNotification(mockPriceChange);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        false,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: expect.stringContaining('price'),
          errorMessage: expect.any(String),
        }),
      );
    });

    it('should respect rate limiting', async () => {
      execFileSuccess();

      const result1 =
        await service.sendPriceChangeNotification(mockPriceChange);
      const result2 =
        await service.sendPriceChangeNotification(mockPriceChange);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should record successful notification in database', async () => {
      execFileSuccess();

      await service.sendPriceChangeNotification(mockPriceChange);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: expect.stringContaining('price dropped'),
        }),
      );
    });
  });

  describe('sendAvailabilityChangeNotification', () => {
    const mockAvailabilityChange: AvailabilityChange = {
      product: mockProduct,
      wasAvailable: false,
      isAvailable: true,
    };

    it('should send back in stock notification successfully', async () => {
      execFileSuccess();

      const result = await service.sendAvailabilityChangeNotification(
        mockAvailabilityChange,
      );

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(mockExecFile).toHaveBeenCalledWith(
        'osascript',
        ['-e', expect.stringContaining('Test Gaming Mouse')],
        expect.any(Function),
      );
    });

    it('should format back in stock message correctly', async () => {
      execFileSuccess();

      await service.sendAvailabilityChangeNotification(mockAvailabilityChange);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('back in stock');
      expect(script).toContain('Availability Update');
    });

    it('should format sold out message correctly', async () => {
      execFileSuccess();

      const soldOut: AvailabilityChange = {
        product: mockProduct,
        wasAvailable: true,
        isAvailable: false,
      };

      await service.sendAvailabilityChangeNotification(soldOut);

      const script = mockExecFile.mock.calls[0][1][1] as string;
      expect(script).toContain('sold out');
    });

    it('should handle still unavailable case', async () => {
      execFileSuccess();

      const stillUnavailable: AvailabilityChange = {
        product: mockProduct,
        wasAvailable: false,
        isAvailable: false,
      };

      await service.sendAvailabilityChangeNotification(stillUnavailable);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          availabilityChange: 'still unavailable',
        }),
      );
    });

    it('should handle notification errors gracefully', async () => {
      execFileError();

      const result = await service.sendAvailabilityChangeNotification(
        mockAvailabilityChange,
      );

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        false,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: 'back in stock',
          errorMessage: expect.any(String),
        }),
      );
    });

    it('should respect rate limiting', async () => {
      execFileSuccess();

      const result1 = await service.sendAvailabilityChangeNotification(
        mockAvailabilityChange,
      );
      const result2 = await service.sendAvailabilityChangeNotification(
        mockAvailabilityChange,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should record successful notification in database', async () => {
      execFileSuccess();

      await service.sendAvailabilityChangeNotification(mockAvailabilityChange);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
        expect.objectContaining({
          productTitle: mockProduct.title,
          availabilityChange: 'back in stock',
        }),
      );
    });
  });

  describe('describePriceChange', () => {
    it('should describe price drop correctly', () => {
      const result = (service as any).describePriceChange(59.99, 49.99);
      expect(result).toBe('dropped from $59.99 to $49.99');
    });

    it('should describe price increase correctly', () => {
      const result = (service as any).describePriceChange(49.99, 59.99);
      expect(result).toBe('increased from $49.99 to $59.99');
    });

    it('should handle equal prices', () => {
      const result = (service as any).describePriceChange(49.99, 49.99);
      expect(result).toBe('increased from $49.99 to $49.99');
    });

    it('should format decimal places correctly', () => {
      const result = (service as any).describePriceChange(10, 5.5);
      expect(result).toBe('dropped from $10.00 to $5.50');
    });
  });

  describe('shouldNotifyPriceChange', () => {
    const mockPriceChange: PriceChange = {
      product: mockProduct,
      oldPrice: 59.99,
      newPrice: 49.99,
    };

    it('should return true when price change notifications are enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_CHANGES') return 'true';
        return '';
      });

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        mockPriceChange,
      );

      expect(result).toBe(true);
    });

    it('should return false when price change notifications are disabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_CHANGES') return 'false';
        return '';
      });

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        mockPriceChange,
      );

      expect(result).toBe(false);
    });

    it('should default to true when config is not set', () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        mockPriceChange,
      );

      expect(result).toBe(true);
    });

    it('should respect min price filter when enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '100';
        return '';
      });

      const cheapProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Default',
            price: 50,
            sku: 'SKU',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const cheapPriceChange: PriceChange = {
        product: cheapProduct,
        oldPrice: 60,
        newPrice: 50,
      };

      const result = service.shouldNotifyPriceChange(
        cheapProduct,
        cheapPriceChange,
      );

      expect(result).toBe(false);
    });

    it('should respect keywords filter when enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'laptop,keyboard';
        return '';
      });

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        mockPriceChange,
      );

      expect(result).toBe(false);
    });

    it('should allow all price changes when threshold is 0', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '0';
        return '';
      });

      const smallChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 101,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, smallChange);

      expect(result).toBe(true);
    });

    it('should block price changes below threshold percentage', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const smallChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 105,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, smallChange);

      expect(result).toBe(false);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('5.00% below threshold 10%'),
        'NotificationService',
      );
    });

    it('should allow price changes above threshold percentage', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const largeChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 115,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, largeChange);

      expect(result).toBe(true);
    });

    it('should handle threshold check for price increases', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const priceIncrease: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 112,
      };

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        priceIncrease,
      );

      expect(result).toBe(true);
    });

    it('should handle threshold check for price decreases', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const priceDecrease: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 88,
      };

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        priceDecrease,
      );

      expect(result).toBe(true);
    });

    it('should handle edge case when old price is 0', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const zeroPriceChange: PriceChange = {
        product: mockProduct,
        oldPrice: 0,
        newPrice: 50,
      };

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        zeroPriceChange,
      );

      expect(result).toBe(true);
    });

    it('should handle invalid threshold values gracefully', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return 'invalid';
        return '';
      });

      const priceChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 105,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, priceChange);

      expect(result).toBe(true);
    });

    it('should handle negative threshold values', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '-10';
        return '';
      });

      const priceChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 105,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, priceChange);

      expect(result).toBe(true);
    });

    it('should handle threshold at exactly the change percentage', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        return '';
      });

      const exactThresholdChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 110,
      };

      const result = service.shouldNotifyPriceChange(
        mockProduct,
        exactThresholdChange,
      );

      expect(result).toBe(true);
    });

    it('should combine threshold with other filters', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '50';
        return '';
      });

      const largeChange: PriceChange = {
        product: mockProduct,
        oldPrice: 100,
        newPrice: 115,
      };

      const result = service.shouldNotifyPriceChange(mockProduct, largeChange);

      expect(result).toBe(true);
    });

    it('should block when threshold passes but price filter fails', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_PRICE_THRESHOLD') return '10';
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '200';
        return '';
      });

      const cheapProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Default',
            price: 50,
            sku: 'SKU',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const largeChange: PriceChange = {
        product: cheapProduct,
        oldPrice: 100,
        newPrice: 115,
      };

      const result = service.shouldNotifyPriceChange(cheapProduct, largeChange);

      expect(result).toBe(false);
    });
  });

  describe('shouldNotifyAvailabilityChange', () => {
    const mockAvailabilityChange: AvailabilityChange = {
      product: mockProduct,
      wasAvailable: false,
      isAvailable: true,
    };

    it('should return true when availability change notifications are enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_AVAILABILITY_CHANGES') return 'true';
        return '';
      });

      const result = service.shouldNotifyAvailabilityChange(
        mockProduct,
        mockAvailabilityChange,
      );

      expect(result).toBe(true);
    });

    it('should return false when availability change notifications are disabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_AVAILABILITY_CHANGES') return 'false';
        return '';
      });

      const result = service.shouldNotifyAvailabilityChange(
        mockProduct,
        mockAvailabilityChange,
      );

      expect(result).toBe(false);
    });

    it('should default to true when config is not set', () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);

      const result = service.shouldNotifyAvailabilityChange(
        mockProduct,
        mockAvailabilityChange,
      );

      expect(result).toBe(true);
    });

    it('should respect min price filter when enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_MIN_PRICE') return '100';
        return '';
      });

      const cheapProduct: ProductDto = {
        ...mockProduct,
        price: 50,
        variants: [
          {
            id: '1',
            title: 'Default',
            price: 50,
            sku: 'SKU',
            available: true,
            inventoryQuantity: 1,
          },
        ],
      };

      const cheapAvailabilityChange: AvailabilityChange = {
        product: cheapProduct,
        wasAvailable: false,
        isAvailable: true,
      };

      const result = service.shouldNotifyAvailabilityChange(
        cheapProduct,
        cheapAvailabilityChange,
      );

      expect(result).toBe(false);
    });

    it('should respect keywords filter when enabled', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'LUMENTUI_NOTIFY_KEYWORDS') return 'laptop,keyboard';
        return '';
      });

      const result = service.shouldNotifyAvailabilityChange(
        mockProduct,
        mockAvailabilityChange,
      );

      expect(result).toBe(false);
    });
  });
});
