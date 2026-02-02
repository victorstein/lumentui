import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LoggerService } from '../../common/logger/logger.service';
import { DatabaseService } from '../storage/database/database.service';
import { ProductDto } from '../api/dto/product.dto';
import { exec } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
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

  const mockPhoneNumber = '+50586826131';

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
        if (key === 'NOTIFICATION_PHONE') return mockPhoneNumber;
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

    it('should log warning if NOTIFICATION_PHONE is not set', async () => {
      mockConfigService.get = jest.fn().mockReturnValue('');

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

      module.get<NotificationService>(NotificationService);

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('NOTIFICATION_PHONE not set'),
        'NotificationService',
      );
    });

    it('should rebuild rate limit cache from database on initialization', async () => {
      const recentNotifications = [
        { product_id: 'prod1', last_sent: Date.now() - 30 * 60 * 1000 }, // 30 min ago
        { product_id: 'prod2', last_sent: Date.now() - 10 * 60 * 1000 }, // 10 min ago
      ];

      mockDbAll.mockReturnValue(recentNotifications);

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

      const testService = module.get<NotificationService>(NotificationService);
      await testService.onModuleInit();

      expect(mockDbPrepare).toHaveBeenCalled();
      expect(mockDbAll).toHaveBeenCalledWith(expect.any(Number));
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
      mockDbPrepare.mockImplementation(() => {
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
            useValue: mockDatabaseService,
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
    it('should send notification successfully with explicit phone number', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result).toBe(true);
      expect(exec).toHaveBeenCalledTimes(1);

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];
      expect(execCall).toContain('clawdbot message send');
      expect(execCall).toContain('--channel whatsapp');
      expect(execCall).toContain(`--target "${mockPhoneNumber}"`);
      expect(execCall).toContain('PRODUCTO DISPONIBLE');
    });

    it('should use default phone number from config', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const result = await service.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(true);
      expect(exec).toHaveBeenCalled();

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];
      expect(execCall).toContain(mockPhoneNumber);
    });

    it('should return false if no phone number is provided', async () => {
      mockConfigService.get = jest.fn().mockReturnValue('');

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

      const testService = module.get<NotificationService>(NotificationService);

      const result =
        await testService.sendAvailabilityNotification(mockProduct);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('no phone number'),
        'NotificationService',
      );
    });

    it('should handle exec errors gracefully', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(new Error('Command failed'), null);
        },
      );

      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockDbPrepare).toHaveBeenCalled();
      expect(mockDbRun).toHaveBeenCalledWith(
        mockProduct.id,
        expect.any(Number),
        0, // sent = false
      );
    });

    it('should record successful notification in database', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      await service.sendAvailabilityNotification(mockProduct, mockPhoneNumber);

      expect(mockDbPrepare).toHaveBeenCalled();
      expect(mockDbRun).toHaveBeenCalledWith(
        mockProduct.id,
        expect.any(Number),
        1, // sent = true
      );
    });
  });

  describe('Message formatting', () => {
    it('should format message with all product details', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      await service.sendAvailabilityNotification(mockProduct, mockPhoneNumber);

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];

      // Check message contains key elements
      expect(execCall).toContain('PRODUCTO DISPONIBLE');
      expect(execCall).toContain(mockProduct.title);
      expect(execCall).toContain('$59.99');
      expect(execCall).toContain('Variantes disponibles');
      expect(execCall).toContain(mockProduct.url);
    });

    it('should list variants when 5 or fewer', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      await service.sendAvailabilityNotification(mockProduct, mockPhoneNumber);

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];

      expect(execCall).toContain('Black');
      expect(execCall).toContain('White');
      expect(execCall).toContain('5 en stock');
      expect(execCall).toContain('3 en stock');
    });

    it('should not list individual variants when more than 5', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const productWithManyVariants: ProductDto = {
        ...mockProduct,
        variants: Array.from({ length: 7 }, (_, i) => ({
          id: `v${i}`,
          title: `Variant ${i}`,
          price: 59.99,
          sku: `SKU-${i}`,
          available: true,
          inventoryQuantity: 1,
        })),
      };

      await service.sendAvailabilityNotification(
        productWithManyVariants,
        mockPhoneNumber,
      );

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];

      expect(execCall).toContain('Variantes disponibles: *7*');
      expect(execCall).not.toContain('Variant 0');
    });

    it('should escape special characters in message', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const productWithSpecialChars: ProductDto = {
        ...mockProduct,
        title: 'Test $100 "Special" Product `with` \\backslash',
      };

      await service.sendAvailabilityNotification(
        productWithSpecialChars,
        mockPhoneNumber,
      );

      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];

      // Special characters should be escaped
      expect(execCall).toContain('\\$100');
      expect(execCall).toContain('\\"Special\\"');
      expect(execCall).toContain('\\`with\\`');
      expect(execCall).toContain('\\\\backslash');
    });
  });

  describe('Rate limiting', () => {
    it('should allow first notification for a product', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result).toBe(true);
      expect(exec).toHaveBeenCalledTimes(1);
    });

    it('should block duplicate notifications within rate limit window', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      // First notification
      const result1 = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      // Immediate second notification - should be blocked
      const result2 = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(exec).toHaveBeenCalledTimes(1);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
        'NotificationService',
      );
    });

    it('should allow notifications for different products', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const product2: ProductDto = { ...mockProduct, id: '999' };

      const result1 = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );
      const result2 = await service.sendAvailabilityNotification(
        product2,
        mockPhoneNumber,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(exec).toHaveBeenCalledTimes(2);
    });

    it('should provide rate limit status', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      // No notification yet
      let status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(false);
      expect(status.lastNotification).toBeNull();

      // Send notification
      await service.sendAvailabilityNotification(mockProduct, mockPhoneNumber);

      // Check status after notification
      status = service.getRateLimitStatus(mockProduct.id);
      expect(status.isLimited).toBe(true);
      expect(status.lastNotification).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeGreaterThan(0);
      expect(status.minutesUntilUnlocked).toBeLessThanOrEqual(60);
    });

    it('should clear rate limit cache', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      // Send notification
      await service.sendAvailabilityNotification(mockProduct, mockPhoneNumber);

      // Clear cache
      service.clearRateLimitCache();

      // Should allow notification again
      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result).toBe(true);
      expect(exec).toHaveBeenCalledTimes(2);
    });
  });

  describe('getNotificationHistory', () => {
    it('should retrieve notification history for a product', () => {
      const mockHistory = [
        { id: 1, product_id: '123', timestamp: Date.now(), sent: 1 },
        { id: 2, product_id: '123', timestamp: Date.now() - 1000, sent: 1 },
      ];

      mockDbAll.mockReturnValue(mockHistory);

      const history = service.getNotificationHistory('123');

      expect(history).toEqual(mockHistory);
      expect(mockDbPrepare).toHaveBeenCalled();
      expect(mockDbAll).toHaveBeenCalledWith('123', 10);
    });

    it('should respect custom limit', () => {
      mockDbAll.mockReturnValue([]);

      service.getNotificationHistory('123', 5);

      expect(mockDbAll).toHaveBeenCalledWith('123', 5);
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const history = service.getNotificationHistory('123');

      expect(history).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalled();
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
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const productNoVariants: ProductDto = {
        ...mockProduct,
        variants: [],
      };

      const result = await service.sendAvailabilityNotification(
        productNoVariants,
        mockPhoneNumber,
      );

      expect(result).toBe(true);
      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];
      expect(execCall).not.toContain('Variantes disponibles');
    });

    it('should handle product with zero price', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      const productFree: ProductDto = {
        ...mockProduct,
        price: 0,
      };

      const result = await service.sendAvailabilityNotification(
        productFree,
        mockPhoneNumber,
      );

      expect(result).toBe(true);
      const execCall = (exec as unknown as jest.Mock).mock.calls[0][0];
      expect(execCall).not.toContain('Precio:');
    });

    it('should handle exec timeout', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          // Simulate timeout error
          const error: any = new Error('Command timed out');
          error.killed = true;
          callback(error, null);
        },
      );

      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle database recording errors without failing notification', async () => {
      (exec as unknown as jest.Mock).mockImplementation(
        (cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' });
        },
      );

      mockDbPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.sendAvailabilityNotification(
        mockProduct,
        mockPhoneNumber,
      );

      // Notification should still succeed even if DB recording fails
      expect(result).toBe(true);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record notification'),
        'NotificationService',
      );
    });
  });
});
