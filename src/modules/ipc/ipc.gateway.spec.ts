/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IpcGateway } from './ipc.gateway';
import { NotificationService } from '../notification/notification.service';
import * as ipc from 'node-ipc';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mock node-ipc module
jest.mock('node-ipc', () => {
  const mockServer = {
    on: jest.fn(),
    broadcast: jest.fn(),
    emit: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };

  return {
    config: {
      id: '',
      retry: 0,
      silent: false,
    },
    serve: jest.fn((path: string, callback: () => void) => {
      callback();
    }),
    server: mockServer,
  };
});

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  unlinkSync: jest.fn(),
}));

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock PathsUtil
jest.mock('../../common/utils/paths.util', () => ({
  PathsUtil: {
    getIpcSocketPath: jest.fn(() => '/tmp/lumentui.sock'),
  },
}));

describe('IpcGateway', () => {
  let gateway: IpcGateway;
  let module: TestingModule;
  let _configService: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    mockNotificationService = {
      getFormattedHistory: jest.fn().mockReturnValue([]),
      getNotificationStats: jest.fn().mockReturnValue({
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        IpcGateway,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'IPC_SOCKET_PATH') {
                return '/tmp/lumentui.sock';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    gateway = module.get<IpcGateway>(IpcGateway);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Lifecycle', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined();
    });

    it('should start server on module init', async () => {
      await gateway.onModuleInit();

      expect(ipc.serve).toHaveBeenCalledWith(
        '/tmp/lumentui.sock',
        expect.any(Function),
      );
      expect(ipc.server.start).toHaveBeenCalled();
    });

    it('should stop server on module destroy', async () => {
      await gateway.onModuleInit();
      gateway.onModuleDestroy();

      expect(ipc.server.stop).toHaveBeenCalled();
    });

    it('should setup event handlers', async () => {
      await gateway.onModuleInit();

      expect(ipc.server.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(ipc.server.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function),
      );
      expect(ipc.server.on).toHaveBeenCalledWith(
        'force-poll',
        expect.any(Function),
      );
      expect(ipc.server.on).toHaveBeenCalledWith(
        'getNotificationHistory',
        expect.any(Function),
      );
      expect(ipc.server.on).toHaveBeenCalledWith(
        'getNotificationStats',
        expect.any(Function),
      );
      expect(ipc.server.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should clean up stale socket file on startup', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (child_process.exec as jest.Mock).mockImplementation((cmd, callback) => {
        // Simulate lsof returning error (socket not in use)

        callback({ code: 1 }, '', '');
      });

      await gateway.onModuleInit();

      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/lumentui.sock');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/lumentui.sock');
      expect(ipc.server.start).toHaveBeenCalled();
    });

    it('should not clean up socket file on module destroy (deferred to cleanupSocket)', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await gateway.onModuleInit();
      (fs.unlinkSync as jest.Mock).mockClear();
      gateway.onModuleDestroy();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should clean up socket file when cleanupSocket is called', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await gateway.onModuleInit();
      gateway.cleanupSocket();

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/lumentui.sock');
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await gateway.onModuleInit();
    });

    it('should emit heartbeat', () => {
      const timestamp = Date.now();

      gateway.emitHeartbeat(timestamp);

      expect(ipc.server.broadcast).toHaveBeenCalledWith('daemon:heartbeat', {
        timestamp,
      });
    });

    it('should emit products updated', () => {
      const products = [
        {
          id: 'prod1',
          title: 'Product 1',
          handle: 'product-1',
          url: 'https://shop.lumenalta.com/products/product-1',
          vendor: 'Vendor',
          product_type: 'Type',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          published_at: '2024-01-01T00:00:00Z',
          status: 'active',
          variants: [],
          images: [],
          tags: [],
          options: [],
        },
      ];

      gateway.emitProductsUpdated(products);

      expect(ipc.server.broadcast).toHaveBeenCalledWith('products:updated', {
        products,
        count: 1,
        timestamp: expect.any(Number),
      });
    });

    it('should emit new product', () => {
      const product = {
        id: 'prod1',
        title: 'New Product',
        handle: 'new-product',
        url: 'https://shop.lumenalta.com/products/new-product',
        vendor: 'Vendor',
        product_type: 'Type',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        status: 'active',
        variants: [],
        images: [],
        tags: [],
        options: [],
      };

      gateway.emitProductNew(product);

      expect(ipc.server.broadcast).toHaveBeenCalledWith('product:new', {
        product,
        timestamp: expect.any(Number),
      });
    });

    it('should emit error', () => {
      const errorMessage = 'Test error';

      gateway.emitError(errorMessage);

      expect(ipc.server.broadcast).toHaveBeenCalledWith('daemon:error', {
        error: errorMessage,
        timestamp: expect.any(Number),
      });
    });

    it('should emit log', () => {
      const level = 'info';
      const message = 'Test log message';

      gateway.emitLog(level, message);

      expect(ipc.server.broadcast).toHaveBeenCalledWith('log', {
        level,
        message,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Status', () => {
    it('should return status before init', () => {
      const status = gateway.getStatus();

      expect(status).toEqual({
        isRunning: false,
        socketPath: '/tmp/lumentui.sock',
      });
    });

    it('should return status after init', async () => {
      await gateway.onModuleInit();

      const status = gateway.getStatus();

      expect(status).toEqual({
        isRunning: true,
        socketPath: '/tmp/lumentui.sock',
      });
    });

    it('should return status after destroy', async () => {
      await gateway.onModuleInit();
      gateway.onModuleDestroy();

      const status = gateway.getStatus();

      expect(status).toEqual({
        isRunning: false,
        socketPath: '/tmp/lumentui.sock',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should not emit events when server is not running', () => {
      gateway.emitHeartbeat(Date.now());
      gateway.emitProductsUpdated([]);
      gateway.emitError('error');
      gateway.emitLog('info', 'message');

      expect(ipc.server.broadcast).not.toHaveBeenCalled();
    });

    it('should not start server twice', async () => {
      await gateway.onModuleInit();
      await gateway.onModuleInit();

      // Should only be called once
      expect(ipc.serve).toHaveBeenCalledTimes(1);
    });
  });

  describe('Force Poll Handler', () => {
    let forcePollHandler: (data: any, socket: any) => Promise<void>;
    const mockSocket = { id: 'test-socket' };

    beforeEach(async () => {
      await gateway.onModuleInit();

      // Extract the force-poll handler
      const calls = (ipc.server.on as jest.Mock).mock.calls;
      const forcePollCall = calls.find((call) => call[0] === 'force-poll');
      forcePollHandler = forcePollCall[1];
    });

    it('should handle force-poll with successful result', async () => {
      const mockResult = {
        success: true,
        productCount: 10,
        newProducts: 2,
        durationMs: 1500,
      };

      const mockSchedulerService = {
        forcePoll: jest.fn().mockResolvedValue(mockResult),
      };

      gateway.setSchedulerService(mockSchedulerService);

      await forcePollHandler({}, mockSocket);

      expect(mockSchedulerService.forcePoll).toHaveBeenCalled();
      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'force-poll-received',
        expect.any(Object),
      );
      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'force-poll-result',
        expect.objectContaining({
          success: true,
          productCount: 10,
          newProducts: 2,
          durationMs: 1500,
        }),
      );
    });

    it('should handle force-poll with error result', async () => {
      const mockResult = {
        success: false,
        productCount: 0,
        newProducts: 0,
        durationMs: 0,
        error: 'Poll already in progress',
      };

      const mockSchedulerService = {
        forcePoll: jest.fn().mockResolvedValue(mockResult),
      };

      gateway.setSchedulerService(mockSchedulerService);

      await forcePollHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'force-poll-result',
        expect.objectContaining({
          success: false,
          error: 'Poll already in progress',
        }),
      );
    });

    it('should handle force-poll when SchedulerService throws error', async () => {
      const mockSchedulerService = {
        forcePoll: jest.fn().mockRejectedValue(new Error('Test error')),
      };

      gateway.setSchedulerService(mockSchedulerService);

      await forcePollHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'force-poll-result',
        expect.objectContaining({
          success: false,
          error: 'Test error',
        }),
      );
    });

    it('should handle force-poll when SchedulerService is not set', async () => {
      // Don't set scheduler service
      await forcePollHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'force-poll-result',
        expect.objectContaining({
          success: false,
          error: 'SchedulerService not available',
        }),
      );
    });
  });

  describe('Notification History Handler', () => {
    let notificationHistoryHandler: (data: any, socket: any) => void;
    const mockSocket = { id: 'test-socket' };

    beforeEach(async () => {
      await gateway.onModuleInit();

      // Extract the getNotificationHistory handler
      const calls = (ipc.server.on as jest.Mock).mock.calls;
      const historyCall = calls.find(
        (call) => call[0] === 'getNotificationHistory',
      );
      notificationHistoryHandler = historyCall[1];
    });

    it('should handle getNotificationHistory with successful result', () => {
      const mockHistory = [
        {
          id: 1,
          productId: 'prod-123',
          productTitle: 'Test Product',
          timestamp: Date.now(),
          formattedTimestamp: '01/01/2024, 12:00:00',
          status: 'sent',
          availabilityChange: 'became available',
          errorMessage: null,
        },
      ];

      mockNotificationService.getFormattedHistory.mockReturnValue(mockHistory);

      notificationHistoryHandler({}, mockSocket);

      expect(mockNotificationService.getFormattedHistory).toHaveBeenCalledWith(
        {},
      );
      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationHistory-result',
        expect.objectContaining({
          success: true,
          history: mockHistory,
          count: 1,
        }),
      );
    });

    it('should handle getNotificationHistory with filters', () => {
      const filters = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        productId: 'prod-123',
        status: 'sent',
        limit: 50,
        offset: 10,
      };

      const mockHistory = [
        {
          id: 1,
          productId: 'prod-123',
          productTitle: 'Test Product',
          timestamp: Date.now(),
          formattedTimestamp: '01/01/2024, 12:00:00',
          status: 'sent',
          availabilityChange: 'became available',
          errorMessage: null,
        },
      ];

      mockNotificationService.getFormattedHistory.mockReturnValue(mockHistory);

      notificationHistoryHandler(filters, mockSocket);

      expect(mockNotificationService.getFormattedHistory).toHaveBeenCalledWith({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        productId: 'prod-123',
        status: 'sent',
        limit: 50,
        offset: 10,
      });
      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationHistory-result',
        expect.objectContaining({
          success: true,
          history: mockHistory,
          count: 1,
        }),
      );
    });

    it('should handle getNotificationHistory with empty result', () => {
      mockNotificationService.getFormattedHistory.mockReturnValue([]);

      notificationHistoryHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationHistory-result',
        expect.objectContaining({
          success: true,
          history: [],
          count: 0,
        }),
      );
    });

    it('should handle getNotificationHistory when service throws error', () => {
      mockNotificationService.getFormattedHistory.mockImplementation(() => {
        throw new Error('Database error');
      });

      notificationHistoryHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationHistory-result',
        expect.objectContaining({
          success: false,
          history: [],
          count: 0,
          error: 'Database error',
        }),
      );
    });

    it('should sanitize invalid filter types', () => {
      const invalidFilters = {
        dateFrom: 123, // should be string
        dateTo: true, // should be string
        productId: null, // should be string
        status: 'invalid', // should be 'sent' or 'failed'
        limit: 'invalid', // should be number
        offset: -5, // should be >= 0
      };

      mockNotificationService.getFormattedHistory.mockReturnValue([]);

      notificationHistoryHandler(invalidFilters, mockSocket);

      // Should pass empty object since all filters are invalid
      expect(mockNotificationService.getFormattedHistory).toHaveBeenCalledWith(
        {},
      );
    });

    it('should handle partial valid filters', () => {
      const partialFilters = {
        productId: 'prod-123',
        limit: 10,
        invalidField: 'should be ignored',
      };

      mockNotificationService.getFormattedHistory.mockReturnValue([]);

      notificationHistoryHandler(partialFilters, mockSocket);

      // Should only pass valid filters
      expect(mockNotificationService.getFormattedHistory).toHaveBeenCalledWith({
        productId: 'prod-123',
        limit: 10,
      });
    });
  });

  describe('Notification Stats Handler', () => {
    let notificationStatsHandler: (data: any, socket: any) => void;
    const mockSocket = { id: 'test-socket' };

    beforeEach(async () => {
      await gateway.onModuleInit();

      // Extract the getNotificationStats handler
      const calls = (ipc.server.on as jest.Mock).mock.calls;
      const statsCall = calls.find(
        (call) => call[0] === 'getNotificationStats',
      );
      notificationStatsHandler = statsCall[1];
    });

    it('should handle getNotificationStats with successful result', () => {
      const mockStats = {
        totalSent: 10,
        totalFailed: 2,
        countByProduct: [
          {
            productId: 'prod-123',
            productTitle: 'Test Product',
            sentCount: 5,
            failedCount: 1,
            totalCount: 6,
          },
          {
            productId: 'prod-456',
            productTitle: 'Another Product',
            sentCount: 5,
            failedCount: 1,
            totalCount: 6,
          },
        ],
      };

      mockNotificationService.getNotificationStats.mockReturnValue(mockStats);

      notificationStatsHandler({}, mockSocket);

      expect(mockNotificationService.getNotificationStats).toHaveBeenCalled();
      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationStats-result',
        expect.objectContaining({
          success: true,
          stats: mockStats,
        }),
      );
    });

    it('should handle getNotificationStats with empty stats', () => {
      const emptyStats = {
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      };

      mockNotificationService.getNotificationStats.mockReturnValue(emptyStats);

      notificationStatsHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationStats-result',
        expect.objectContaining({
          success: true,
          stats: emptyStats,
        }),
      );
    });

    it('should handle getNotificationStats when service throws error', () => {
      mockNotificationService.getNotificationStats.mockImplementation(() => {
        throw new Error('Database error');
      });

      notificationStatsHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationStats-result',
        expect.objectContaining({
          success: false,
          stats: {
            totalSent: 0,
            totalFailed: 0,
            countByProduct: [],
          },
          error: 'Database error',
        }),
      );
    });

    it('should include timestamp in response', () => {
      const mockStats = {
        totalSent: 5,
        totalFailed: 1,
        countByProduct: [],
      };

      mockNotificationService.getNotificationStats.mockReturnValue(mockStats);

      notificationStatsHandler({}, mockSocket);

      expect(ipc.server.emit).toHaveBeenCalledWith(
        mockSocket,
        'getNotificationStats-result',
        expect.objectContaining({
          success: true,
          timestamp: expect.any(Number),
        }),
      );
    });
  });
});
