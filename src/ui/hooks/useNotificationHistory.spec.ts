/**
 * @jest-environment jsdom
 */

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
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useNotificationHistory,
  FormattedNotification,
} from './useNotificationHistory';
import * as ipc from 'node-ipc';

describe('useNotificationHistory', () => {
  let mockEventHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.useFakeTimers();

    mockEventHandlers = {};

    mockIpcClient.on = jest.fn((event: string, handler: Function) => {
      mockEventHandlers[event] = handler;
    });
    mockIpcClient.emit = jest.fn();

    mockIpc.connectTo = jest.fn(
      (id: string, path: string, callback: Function) => {
        callback();
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch notification history on mount', async () => {
    const mockHistory: FormattedNotification[] = [
      {
        id: 1,
        productId: '123',
        productTitle: 'Test Product',
        timestamp: Date.now(),
        formattedTimestamp: '2026-02-03 10:00:00',
        status: 'sent',
        availabilityChange: 'true -> false',
        errorMessage: null,
      },
      {
        id: 2,
        productId: '456',
        productTitle: 'Another Product',
        timestamp: Date.now() - 1000,
        formattedTimestamp: '2026-02-03 09:59:59',
        status: 'sent',
        availabilityChange: 'false -> true',
        errorMessage: null,
      },
    ];

    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'getNotificationHistory',
      {},
    );

    act(() => {
      mockEventHandlers['getNotificationHistory-result']({
        success: true,
        history: mockHistory,
        count: 2,
        timestamp: Date.now(),
      });
    });

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should apply filters when provided', async () => {
    const filters = {
      productId: '123',
      status: 'sent' as const,
      limit: 10,
    };

    const { result } = renderHook(() => useNotificationHistory(filters));

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'getNotificationHistory',
      filters,
    );
  });

  it('should handle successful result with empty history', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['connect']();
    });

    act(() => {
      mockEventHandlers['getNotificationHistory-result']({
        success: true,
        history: [],
        count: 0,
        timestamp: Date.now(),
      });
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle error result from daemon', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['connect']();
    });

    act(() => {
      mockEventHandlers['getNotificationHistory-result']({
        success: false,
        history: [],
        error: 'Database error',
        timestamp: Date.now(),
      });
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Database error');
  });

  it('should handle connection error (ECONNREFUSED)', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['error'](new Error('ECONNREFUSED'));
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Cannot connect to daemon');
  });

  it('should handle connection error (ENOENT)', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['error'](new Error('ENOENT socket not found'));
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Cannot connect to daemon');
  });

  it('should handle generic error', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['error'](new Error('Something went wrong'));
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Something went wrong');
  });

  it('should handle connection timeout', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Connection timeout');
    expect(mockIpc.disconnect).toHaveBeenCalled();
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(() => useNotificationHistory());

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should refetch data when refetch is called', () => {
    const mockHistory: FormattedNotification[] = [
      {
        id: 1,
        productId: '123',
        productTitle: 'Test Product',
        timestamp: Date.now(),
        formattedTimestamp: '2026-02-03 10:00:00',
        status: 'sent',
        availabilityChange: 'true -> false',
        errorMessage: null,
      },
    ];

    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['connect']();
    });

    act(() => {
      mockEventHandlers['getNotificationHistory-result']({
        success: true,
        history: mockHistory,
        count: 1,
        timestamp: Date.now(),
      });
    });

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.loading).toBe(false);

    const originalEmitCallCount = mockIpcClient.emit.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledTimes(originalEmitCallCount + 1);
  });

  it('should reset error state when refetching', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['error'](new Error('Initial error'));
    });

    expect(result.current.error).toBe('Initial error');

    act(() => {
      result.current.refetch();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should disconnect client on successful result', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['connect']();
    });

    act(() => {
      mockEventHandlers['getNotificationHistory-result']({
        success: true,
        history: [],
        count: 0,
        timestamp: Date.now(),
      });
    });

    expect(mockIpc.disconnect).toHaveBeenCalled();
  });

  it('should disconnect client on error', () => {
    const { result } = renderHook(() => useNotificationHistory());

    act(() => {
      mockEventHandlers['error'](new Error('Test error'));
    });

    expect(mockIpc.disconnect).toHaveBeenCalled();
  });

  it('should handle filters with date range', () => {
    const filters = {
      dateFrom: '2026-02-01',
      dateTo: '2026-02-03',
    };

    const { result } = renderHook(() => useNotificationHistory(filters));

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'getNotificationHistory',
      filters,
    );
  });

  it('should handle filters with status filter', () => {
    const filters = {
      status: 'failed' as const,
    };

    const { result } = renderHook(() => useNotificationHistory(filters));

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'getNotificationHistory',
      filters,
    );
  });

  it('should handle filters with pagination', () => {
    const filters = {
      limit: 20,
      offset: 10,
    };

    const { result } = renderHook(() => useNotificationHistory(filters));

    act(() => {
      mockEventHandlers['connect']();
    });

    expect(mockIpcClient.emit).toHaveBeenCalledWith(
      'getNotificationHistory',
      filters,
    );
  });
});
