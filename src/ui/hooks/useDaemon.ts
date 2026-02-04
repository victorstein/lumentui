/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useState, useEffect, useCallback } from 'react';
import * as ipcModule from 'node-ipc';
import { PathsUtil } from '../../common/utils/paths.util.js';

const ipc = (ipcModule as any).default || ipcModule;

const MAX_LOG_BUFFER = 100;

/**
 * Product data structure from daemon (matches ProductDto)
 */
export interface Product {
  id: string;
  title: string;
  handle: string;
  price: number;
  available: boolean;
  description: string | null;
  url: string;
  variants: Array<{
    id: string;
    title: string;
    price: number;
    sku: string | null;
    available: boolean;
    inventoryQuantity: number;
  }>;
  images: Array<{
    id: string;
    src: string;
    alt: string | null;
    width: number;
    height: number;
  }>;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

/**
 * Notification history filters
 */
export interface NotificationHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  status?: 'sent' | 'failed';
  limit?: number;
  offset?: number;
}

/**
 * Formatted notification entry
 */
export interface FormattedNotification {
  id: number;
  productId: string;
  productTitle: string | null;
  timestamp: number;
  formattedTimestamp: string;
  status: 'sent' | 'failed';
  availabilityChange: string | null;
  errorMessage: string | null;
}

/**
 * Daemon state interface
 */
export interface DaemonState {
  connected: boolean;
  lastHeartbeat: number | null;
  products: Product[];
  logs: LogEntry[];
  error: string | null;
  newProductNotification: Product | null;
  polling: boolean;
  notificationHistory: FormattedNotification[];
  loadingHistory: boolean;
  historyError: string | null;
}

/**
 * Hook to connect to LumenTUI daemon via IPC
 * Listens to daemon events and provides methods to interact
 */
export const useDaemon = () => {
  const [state, setState] = useState<DaemonState>({
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
  });

  const socketPath = PathsUtil.getIpcSocketPath();

  useEffect(() => {
    // Configure IPC client
    ipc.config.id = 'lumentui-tui';
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.config.stopRetrying = false;

    // Connect to daemon
    ipc.connectTo('lumentui-daemon', socketPath, () => {
      const client = ipc.of['lumentui-daemon'];

      // Connection established
      client.on('connect', () => {
        setState((prev) => ({
          ...prev,
          connected: true,
          error: null,
        }));

        // Trigger an immediate poll so the UI isn't empty for a full cycle
        client.emit('force-poll', { timestamp: Date.now() });
        setState((prev) => ({ ...prev, polling: true }));
      });

      // Connection lost
      client.on('disconnect', () => {
        setState((prev) => ({
          ...prev,
          connected: false,
          polling: false,
        }));
      });

      // Heartbeat event
      client.on('daemon:heartbeat', (data: { timestamp: number }) => {
        setState((prev) => ({
          ...prev,
          lastHeartbeat: data.timestamp,
        }));
      });

      // Products updated event
      client.on(
        'products:updated',
        (data: { products: Product[]; count: number; timestamp: number }) => {
          setState((prev) => ({
            ...prev,
            products: data.products,
            polling: false,
          }));
        },
      );

      // New product event
      client.on(
        'product:new',
        (data: { product: Product; timestamp: number }) => {
          setState((prev) => ({
            ...prev,
            newProductNotification: data.product,
          }));

          // Clear notification after 5 seconds
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              newProductNotification: null,
            }));
          }, 20000);
        },
      );

      // Error event
      client.on(
        'daemon:error',
        (data: { error: string; timestamp: number }) => {
          setState((prev) => ({
            ...prev,
            error: data.error,
            polling: false,
          }));
        },
      );

      // Log event
      client.on('log', (data: LogEntry) => {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs.slice(-(MAX_LOG_BUFFER - 1)), data],
        }));
      });

      // Price change event
      client.on(
        'product:price-changed',
        (data: {
          product: Product;
          oldPrice: number;
          newPrice: number;
          oldCompareAtPrice?: number;
          newCompareAtPrice?: number;
          timestamp: number;
        }) => {
          setState((prev) => ({
            ...prev,
            products: prev.products.map((p) =>
              p.id === data.product.id ? data.product : p,
            ),
          }));
        },
      );

      // Availability change event
      client.on(
        'product:availability-changed',
        (data: {
          product: Product;
          wasAvailable: boolean;
          isAvailable: boolean;
          timestamp: number;
        }) => {
          setState((prev) => ({
            ...prev,
            products: prev.products.map((p) =>
              p.id === data.product.id ? data.product : p,
            ),
          }));
        },
      );

      // Notification history result
      client.on(
        'getNotificationHistory-result',
        (result: {
          success: boolean;
          history: FormattedNotification[];
          error?: string;
        }) => {
          if (result.success) {
            setState((prev) => ({
              ...prev,
              notificationHistory: result.history,
              loadingHistory: false,
              historyError: null,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              notificationHistory: [],
              loadingHistory: false,
              historyError:
                result.error || 'Failed to fetch notification history',
            }));
          }
        },
      );

      // Error handler — suppress connection errors (shown via Disconnected status)
      client.on('error', (error: Error) => {
        const isConnectionError =
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ENOENT');
        setState((prev) => ({
          ...prev,
          connected: false,
          error: isConnectionError ? null : error.message,
          polling: isConnectionError ? false : prev.polling,
        }));
      });
    });

    // Cleanup on unmount
    return () => {
      ipc.disconnect('lumentui-daemon');
    };
  }, [socketPath]);

  /**
   * Request force poll from daemon
   */
  const forcePoll = useCallback(() => {
    if (ipc.of['lumentui-daemon']) {
      ipc.of['lumentui-daemon'].emit('force-poll', {
        timestamp: Date.now(),
      });
      setState((prev) => ({ ...prev, polling: true }));
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Clear new product notification
   */
  const clearNotification = useCallback(() => {
    setState((prev) => ({
      ...prev,
      newProductNotification: null,
    }));
  }, []);

  /**
   * Fetch notification history with optional filters
   */
  const fetchNotificationHistory = useCallback(
    (filters?: NotificationHistoryFilters) => {
      if (ipc.of['lumentui-daemon']) {
        setState((prev) => ({
          ...prev,
          loadingHistory: true,
          historyError: null,
        }));
        ipc.of['lumentui-daemon'].emit('getNotificationHistory', filters || {});
      } else {
        setState((prev) => ({
          ...prev,
          loadingHistory: false,
          historyError: 'Not connected to daemon',
        }));
      }
    },
    [],
  );

  return {
    ...state,
    forcePoll,
    clearError,
    clearNotification,
    fetchNotificationHistory,
  };
};
