/**
 * @jest-environment jsdom
 */

// Mock node-ipc before imports
const mockIpcClient = {
  on: jest.fn(),
  emit: jest.fn(),
};

const mockIpc = {
  config: {
    id: '',
    retry: 0,
    silent: true,
  },
  connectTo: jest.fn(),
  disconnect: jest.fn(),
  of: {
    'lumentui-daemon': mockIpcClient,
  },
};

jest.mock('node-ipc', () => mockIpc);

/* eslint-disable */
import { renderHook, act } from '@testing-library/react';
import { useDaemon } from './useDaemon';
import * as ipc from 'node-ipc';

/**
 * Tests for useDaemon hook
 *
 * Note: These tests mock node-ipc to avoid actual socket connections
 */

describe('useDaemon', () => {
  let mockEventHandlers: Record<string, Function>;

  beforeEach(() => {
    // Reset mocks
    mockEventHandlers = {};

    // Reset mock client functions
    mockIpcClient.on = jest.fn((event: string, handler: Function) => {
      mockEventHandlers[event] = handler;
    });
    mockIpcClient.emit = jest.fn();

    // Mock connectTo to invoke callback immediately
    mockIpc.connectTo = jest.fn(
      (id: string, path: string, callback: Function) => {
        callback();
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDaemon());

    expect(result.current.connected).toBe(false);
    expect(result.current.lastHeartbeat).toBeNull();
    expect(result.current.products).toEqual([]);
    expect(result.current.logs).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.newProductNotification).toBeNull();
  });

  it('should set connected to true on connect event', () => {
    const { result } = renderHook(() => useDaemon());

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should set connected to false on disconnect event', () => {
    const { result } = renderHook(() => useDaemon());

    // First connect
    act(() => {
      mockEventHandlers['connect']();
    });

    expect(result.current.connected).toBe(true);

    // Then disconnect
    act(() => {
      mockEventHandlers['disconnect']();
    });

    expect(result.current.connected).toBe(false);
  });

  it('should update lastHeartbeat on heartbeat event', () => {
    const { result } = renderHook(() => useDaemon());
    const timestamp = Date.now();

    act(() => {
      mockEventHandlers['daemon:heartbeat']({ timestamp });
    });

    expect(result.current.lastHeartbeat).toBe(timestamp);
  });

  it('should update products on products:updated event', () => {
    const { result } = renderHook(() => useDaemon());
    const mockProducts = [
      {
        id: '1',
        title: 'Test Product',
        handle: 'test-product',
        price: 10,
        available: true,
        description: null,
        url: 'https://shop.lumenalta.com/products/test-product',
        variants: [],
        images: [],
      },
    ];

    act(() => {
      mockEventHandlers['products:updated']({
        products: mockProducts,
        count: 1,
        timestamp: Date.now(),
      });
    });

    expect(result.current.products).toEqual(mockProducts);
  });

  it('should show notification on product:new event', () => {
    const { result } = renderHook(() => useDaemon());
    const mockProduct = {
      id: '2',
      title: 'New Product',
      handle: 'new-product',
      price: 20,
      available: true,
      description: null,
      url: 'https://shop.lumenalta.com/products/new-product',
      variants: [],
      images: [],
    };

    act(() => {
      mockEventHandlers['product:new']({
        product: mockProduct,
        timestamp: Date.now(),
      });
    });

    expect(result.current.newProductNotification).toEqual(mockProduct);
  });

  it('should clear notification after 20 seconds', () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useDaemon());
    const mockProduct = {
      id: '2',
      title: 'New Product',
      handle: 'new-product',
      price: 20,
      available: true,
      description: null,
      url: 'https://shop.lumenalta.com/products/new-product',
      variants: [],
      images: [],
    };

    act(() => {
      mockEventHandlers['product:new']({
        product: mockProduct,
        timestamp: Date.now(),
      });
    });

    expect(result.current.newProductNotification).toEqual(mockProduct);

    // Fast-forward 20 seconds
    act(() => {
      jest.advanceTimersByTime(20000);
    });

    expect(result.current.newProductNotification).toBeNull();

    jest.useRealTimers();
  });

  it('should set error on daemon:error event', () => {
    const { result } = renderHook(() => useDaemon());
    const errorMessage = 'Test error';

    act(() => {
      mockEventHandlers['daemon:error']({
        error: errorMessage,
        timestamp: Date.now(),
      });
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('should add log entries on log event', () => {
    const { result } = renderHook(() => useDaemon());
    const logEntry = {
      level: 'info',
      message: 'Test log',
      timestamp: Date.now(),
    };

    act(() => {
      mockEventHandlers['log'](logEntry);
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]).toEqual(logEntry);
  });

  it('should keep only last 100 logs', () => {
    const { result } = renderHook(() => useDaemon());

    // Add 110 logs
    act(() => {
      for (let i = 0; i < 110; i++) {
        mockEventHandlers['log']({
          level: 'info',
          message: `Log ${i}`,
          timestamp: Date.now() + i,
        });
      }
    });

    // Should only keep last 100
    expect(result.current.logs).toHaveLength(100);
    expect(result.current.logs[0].message).toBe('Log 10');
    expect(result.current.logs[99].message).toBe('Log 109');
  });

  it('should emit force-poll event', () => {
    const { result } = renderHook(() => useDaemon());

    act(() => {
      result.current.forcePoll();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'force-poll',
      expect.objectContaining({
        timestamp: expect.any(Number),
      }),
    );
  });

  it('should clear error when clearError is called', () => {
    const { result } = renderHook(() => useDaemon());

    // Set an error first
    act(() => {
      mockEventHandlers['daemon:error']({
        error: 'Test error',
        timestamp: Date.now(),
      });
    });

    expect(result.current.error).toBe('Test error');

    // Clear error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should clear notification when clearNotification is called', () => {
    const { result } = renderHook(() => useDaemon());
    const mockProduct = {
      id: '2',
      title: 'New Product',
      handle: 'new-product',
      price: 20,
      available: true,
      description: null,
      url: 'https://shop.lumenalta.com/products/new-product',
      variants: [],
      images: [],
    };

    // Set notification first
    act(() => {
      mockEventHandlers['product:new']({
        product: mockProduct,
        timestamp: Date.now(),
      });
    });

    expect(result.current.newProductNotification).toEqual(mockProduct);

    // Clear notification
    act(() => {
      result.current.clearNotification();
    });

    expect(result.current.newProductNotification).toBeNull();
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useDaemon());

    unmount();

    expect(mockIpc.disconnect).toHaveBeenCalledWith('lumentui-daemon');
  });
});
