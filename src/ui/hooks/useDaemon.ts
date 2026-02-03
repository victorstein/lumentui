/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useState, useEffect, useCallback } from 'react';
import * as ipcModule from 'node-ipc';

const ipc = (ipcModule as any).default || ipcModule;

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
  });

  const socketPath = '/tmp/lumentui.sock';

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
          }, 5000);
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
          logs: [...prev.logs.slice(-9), data], // Keep last 10 logs
        }));
      });

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

  return {
    ...state,
    forcePoll,
    clearError,
    clearNotification,
  };
};
