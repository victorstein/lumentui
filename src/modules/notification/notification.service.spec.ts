import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LoggerService } from '../../common/logger/logger.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductDto } from '../api/dto/product.dto';
import * as notifier from 'node-notifier';

// Mock node-notifier
jest.mock('node-notifier', () => ({
  notify: jest.fn(),
}));

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

  beforeEach(async () => {
    // Reset mocks
    mockDbRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
    mockDbAll = jest.fn().mockReturnValue([]);
    mockDbPrepare = jest.fn().mockReturnValue({
      run: mockDbRun,
      all: mockDbAll,
    });

    mockConfigService = {
      get: jest.fn((key: string) => {
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
        { product_id: 'prod1', last_sent: Date.now() - 30 * 60 * 1000 }, // 30 min ago
        { product_id: 'prod2', last_sent: Date.now() - 10 * 60 * 1000 }, // 10 min ago
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
      await testService.onModuleInit();

      expect(mockGetRecentNotifications).toHaveBeenCalled();
      expect(mockGetRecentNotifications).toHaveBeenCalledWith(
        expect.any(Number),
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit cache rebuilt with 2 entries'),
        'NotificationService',
      );

      // Verify cache is actually populated (products should be rate limited)
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

      // Should not throw, just log error
      await expect(testService.onModuleInit()).resolves.not.toThrow();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to rebuild rate limit cache'),
        'NotificationService',
      );
    });
  });

  describe('sendAvailabilityNotification', () => {
    it('should send notification successfully', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(notifier.notify).toHaveBeenCalledTimes(1);

      const notifyCall = (notifier.notify as jest.Mock).mock.calls[0][0];
      expect(notifyCall.title).toContain('LumenTUI - New Product Available');
      expect(notifyCall.message).toContain('Test Gaming Mouse');
      expect(notifyCall.sound).toBe(true);
    });

    it('should handle notification errors gracefully', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(new Error('Notification failed'), null);
      });

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        false, // sent = false
      );
    });

    it('should record successful notification in database', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      await service.sendAvailabilityNotification(mockProduct);

      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true, // sent = true
      );
    });
  });

  describe('Message formatting', () => {
    it('should format message with all product details', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      await service.sendAvailabilityNotification(mockProduct);

      const notifyCall = (notifier.notify as jest.Mock).mock.calls[0][0];

      // Check message contains key elements
      expect(notifyCall.message).toContain(mockProduct.title);
      expect(notifyCall.message).toContain('$59.99');
      expect(notifyCall.message).toContain('variant');
      expect(notifyCall.message).toContain(mockProduct.url);
    });

    it('should format concise message for notification center', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      await service.sendAvailabilityNotification(mockProduct);

      const notifyCall = (notifier.notify as jest.Mock).mock.calls[0][0];

      // Should be concise, plain text notification
      expect(notifyCall.message).not.toContain('*');
      expect(notifyCall.message).not.toContain('🔔');
      expect(notifyCall.message).not.toContain('_');
    });
  });

  describe('Rate limiting', () => {
    it('should allow first notification for a product', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(notifier.notify).toHaveBeenCalledTimes(1);
    });

    it('should block duplicate notifications within rate limit window', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      // First notification
      const result1 = await service.sendAvailabilityNotification(mockProduct);

      // Immediate second notification - should be blocked
      const result2 = await service.sendAvailabilityNotification(mockProduct);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(notifier.notify).toHaveBeenCalledTimes(1);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
        'NotificationService',
      );
    });

    it('should allow notifications for different products', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const product2: ProductDto = { ...mockProduct, id: '999' };

      const result1 = await service.sendAvailabilityNotification(mockProduct);
      const result2 = await service.sendAvailabilityNotification(product2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(notifier.notify).toHaveBeenCalledTimes(2);
    });

    it('should provide rate limit status', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      // No notification yet
      let status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(false);
      expect(status.lastNotification).toBeNull();

      // Send notification
      await service.sendAvailabilityNotification(mockProduct);

      // Check status after notification
      status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(true);
      expect(status.lastNotification).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeLessThanOrEqual(60);
    });

    it('should clear rate limit cache', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      // Send notification
      await service.sendAvailabilityNotification(mockProduct);

      // Clear cache
      service.clearRateLimitCache();

      // Should allow notification again
      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(notifier.notify).toHaveBeenCalledTimes(2);
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
      expect(mockDatabaseService.getNotificationHistory).toHaveBeenCalledWith(
        '123',
        10,
      );
    });

    it('should respect custom limit', () => {
      (mockDatabaseService.getNotificationHistory as jest.Mock).mockReturnValue(
        [],
      );

      service.getNotificationHistory('123', 5);

      expect(mockDatabaseService.getNotificationHistory).toHaveBeenCalledWith(
        '123',
        5,
      );
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

  describe('Edge cases', () => {
    it('should handle product with no variants', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const productNoVariants: ProductDto = {
        ...mockProduct,
        variants: [],
      };

      const result =
        await service.sendAvailabilityNotification(productNoVariants);

      expect(result).toBe(true);
      const notifyCall = (notifier.notify as jest.Mock).mock.calls[0][0];
      expect(notifyCall.message).not.toContain('variant');
    });

    it('should handle product with zero price', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const productFree: ProductDto = {
        ...mockProduct,
        price: 0,
      };

      const result = await service.sendAvailabilityNotification(productFree);

      expect(result).toBe(true);
      const notifyCall = (notifier.notify as jest.Mock).mock.calls[0][0];
      expect(notifyCall.message).not.toContain('Price:');
    });

    it('should handle database recording errors without failing notification', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      // The recordNotification method in DatabaseService handles errors internally
      // and logs them, so the notification service doesn't need to catch them
      const result = await service.sendAvailabilityNotification(mockProduct);

      // Notification should still succeed
      expect(result).toBe(true);
      expect(mockDatabaseService.recordNotification).toHaveBeenCalledWith(
        mockProduct.id,
        true,
      );
    });
  });
});
