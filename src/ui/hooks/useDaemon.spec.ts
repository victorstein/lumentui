import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDaemon } from './useDaemon';
import * as ipc from 'node-ipc';

/**
 * Tests for useDaemon hook
 * 
 * Note: These tests mock node-ipc to avoid actual socket connections
 */

// Mock node-ipc
vi.mock('node-ipc', () => ({
  default: {
    config: {
      id: '',
      retry: 0,
      silent: true,
    },
    connectTo: vi.fn(),
    disconnect: vi.fn(),
    of: {},
  },
}));

describe('useDaemon', () => {
  let mockClient: any;
  let mockEventHandlers: Record<string, Function>;

  beforeEach(() => {
    // Reset mocks
    mockEventHandlers = {};
    
    // Create mock client
    mockClient = {
      on: vi.fn((event: string, handler: Function) => {
        mockEventHandlers[event] = handler;
      }),
      emit: vi.fn(),
    };

    // Mock ipc.of to return our mock client
    (ipc as any).of = {
      'lumentui-daemon': mockClient,
    };

    // Mock connectTo
    (ipc as any).connectTo = vi.fn((id: string, path: string, callback: Function) => {
      callback();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
        id: 1,
        title: 'Test Product',
        handle: 'test-product',
        vendor: 'Test Vendor',
        productType: 'Test Type',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        publishedAt: '2024-01-01',
        available: true,
        tags: ['test'],
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
      id: 1,
      title: 'New Product',
      handle: 'new-product',
      vendor: 'Test Vendor',
      productType: 'Test Type',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      publishedAt: '2024-01-01',
      available: true,
      tags: ['new'],
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

  it('should clear notification after 5 seconds', () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => useDaemon());
    const mockProduct = {
      id: 1,
      title: 'New Product',
      handle: 'new-product',
      vendor: 'Test Vendor',
      productType: 'Test Type',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      publishedAt: '2024-01-01',
      available: true,
      tags: ['new'],
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

    // Fast-forward 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.newProductNotification).toBeNull();

    vi.useRealTimers();
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

  it('should keep only last 10 logs', () => {
    const { result } = renderHook(() => useDaemon());

    // Add 15 logs
    act(() => {
      for (let i = 0; i < 15; i++) {
        mockEventHandlers['log']({
          level: 'info',
          message: `Log ${i}`,
          timestamp: Date.now() + i,
        });
      }
    });

    // Should only keep last 10
    expect(result.current.logs).toHaveLength(10);
    expect(result.current.logs[0].message).toBe('Log 5');
    expect(result.current.logs[9].message).toBe('Log 14');
  });

  it('should emit force-poll event', () => {
    const { result } = renderHook(() => useDaemon());

    act(() => {
      result.current.forcePoll();
    });

    expect(mockClient.emit).toHaveBeenCalledWith(
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
      id: 1,
      title: 'New Product',
      handle: 'new-product',
      vendor: 'Test Vendor',
      productType: 'Test Type',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      publishedAt: '2024-01-01',
      available: true,
      tags: ['new'],
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

    expect(ipc.disconnect).toHaveBeenCalledWith('lumentui-daemon');
  });
});
