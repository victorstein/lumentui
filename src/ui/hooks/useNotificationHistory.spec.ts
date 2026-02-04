/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import {
  useNotificationHistory,
  FormattedNotification,
} from './useNotificationHistory';
import * as DaemonContextModule from '../context/DaemonContext.js';

jest.mock('../context/DaemonContext.js');

describe('useNotificationHistory', () => {
  const mockFetchNotificationHistory = jest.fn();

  const defaultDaemonState = {
    connected: false,
    lastHeartbeat: null,
    products: [],
    logs: [],
    error: null,
    newProductNotification: null,
    polling: false,
    notificationHistory: [],
    loadingHistory: false,
    historyError: null,
    forcePoll: jest.fn(),
    clearError: jest.fn(),
    clearNotification: jest.fn(),
    fetchNotificationHistory: mockFetchNotificationHistory,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: true,
    });
  });

  it('should initialize with default state when not connected', () => {
    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: false,
    });

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch notification history on mount when connected', () => {
    renderHook(() => useNotificationHistory());

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(undefined);
  });

  it('should apply filters when provided', () => {
    const filters = {
      productId: '123',
      status: 'sent' as const,
      limit: 10,
    };

    renderHook(() => useNotificationHistory(filters));

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(filters);
  });

  it('should return notification history from daemon context', () => {
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

    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: true,
      notificationHistory: mockHistory,
    });

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return empty history when no notifications exist', () => {
    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: true,
      notificationHistory: [],
    });

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle error from daemon', () => {
    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: true,
      historyError: 'Database error',
    });

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Database error');
  });

  it('should indicate loading state', () => {
    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: true,
      loadingHistory: true,
    });

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.loading).toBe(true);
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(() => useNotificationHistory());

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should call fetchNotificationHistory when refetch is called', () => {
    const { result } = renderHook(() => useNotificationHistory());

    mockFetchNotificationHistory.mockClear();

    act(() => {
      result.current.refetch();
    });

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(undefined);
  });

  it('should call fetchNotificationHistory with filters on refetch', () => {
    const filters = {
      dateFrom: '2026-02-01',
      dateTo: '2026-02-03',
    };

    const { result } = renderHook(() => useNotificationHistory(filters));

    mockFetchNotificationHistory.mockClear();

    act(() => {
      result.current.refetch();
    });

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(filters);
  });

  it('should not fetch when not connected', () => {
    (DaemonContextModule.useDaemonContext as jest.Mock).mockReturnValue({
      ...defaultDaemonState,
      connected: false,
    });

    renderHook(() => useNotificationHistory());

    expect(mockFetchNotificationHistory).not.toHaveBeenCalled();
  });

  it('should handle filters with status filter', () => {
    const filters = {
      status: 'failed' as const,
    };

    renderHook(() => useNotificationHistory(filters));

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(filters);
  });

  it('should handle filters with pagination', () => {
    const filters = {
      limit: 20,
      offset: 10,
    };

    renderHook(() => useNotificationHistory(filters));

    expect(mockFetchNotificationHistory).toHaveBeenCalledWith(filters);
  });
});
