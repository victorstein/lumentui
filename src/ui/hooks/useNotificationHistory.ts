/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useState, useEffect, useCallback } from 'react';
import * as ipcModule from 'node-ipc';
import { PathsUtil } from '../../common/utils/paths.util';

const ipc = (ipcModule as any).default || ipcModule;

export interface NotificationHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  status?: 'sent' | 'failed';
  limit?: number;
  offset?: number;
}

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

export interface NotificationHistoryState {
  history: FormattedNotification[];
  loading: boolean;
  error: string | null;
}

export const useNotificationHistory = (
  filters?: NotificationHistoryFilters,
) => {
  const [state, setState] = useState<NotificationHistoryState>({
    history: [],
    loading: false,
    error: null,
  });

  const socketPath = PathsUtil.getIpcSocketPath();

  const fetchHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    const clientId = `lumentui-tui-history-${Date.now()}`;
    const timeout = setTimeout(() => {
      ipc.disconnect(clientId);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Connection timeout',
      }));
    }, 5000);

    ipc.config.id = clientId;
    ipc.config.retry = 1500;
    ipc.config.silent = true;

    ipc.connectTo('lumentui-daemon', socketPath, () => {
      const client = ipc.of['lumentui-daemon'];

      client.on('connect', () => {
        client.emit('getNotificationHistory', filters || {});
      });

      client.on(
        'getNotificationHistory-result',
        (result: {
          success: boolean;
          history: FormattedNotification[];
          error?: string;
        }) => {
          clearTimeout(timeout);
          ipc.disconnect(clientId);

          if (result.success) {
            setState({
              history: result.history,
              loading: false,
              error: null,
            });
          } else {
            setState({
              history: [],
              loading: false,
              error: result.error || 'Failed to fetch notification history',
            });
          }
        },
      );

      client.on('error', (error: Error) => {
        clearTimeout(timeout);
        ipc.disconnect(clientId);

        const isConnectionError =
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ENOENT');

        setState({
          history: [],
          loading: false,
          error: isConnectionError ? 'Cannot connect to daemon' : error.message,
        });
      });
    });
  }, [socketPath, filters]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    ...state,
    refetch: fetchHistory,
  };
};
