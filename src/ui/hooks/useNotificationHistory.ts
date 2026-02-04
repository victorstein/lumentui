import { useEffect, useCallback } from 'react';
import { useDaemonContext } from '../context/DaemonContext.js';
import type { NotificationHistoryFilters } from './useDaemon.js';

export type {
  NotificationHistoryFilters,
  FormattedNotification,
} from './useDaemon.js';

export interface NotificationHistoryState {
  history: any[];
  loading: boolean;
  error: string | null;
}

export const useNotificationHistory = (
  filters?: NotificationHistoryFilters,
) => {
  const {
    notificationHistory,
    loadingHistory,
    historyError,
    fetchNotificationHistory,
    connected,
  } = useDaemonContext();

  const fetchHistory = useCallback(() => {
    if (connected) {
      fetchNotificationHistory(filters);
    }
  }, [connected, fetchNotificationHistory, filters]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history: notificationHistory,
    loading: loadingHistory,
    error: historyError,
    refetch: fetchHistory,
  };
};
