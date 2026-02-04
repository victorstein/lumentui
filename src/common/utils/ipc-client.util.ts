import * as ipcModule from 'node-ipc';
import { PathsUtil } from './paths.util';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

export interface NotificationHistoryResult {
  success: boolean;
  history: FormattedNotification[];
  count: number;
  error?: string;
  timestamp: number;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  countByProduct: Array<{
    productId: string;
    productTitle: string | null;
    sentCount: number;
    failedCount: number;
    totalCount: number;
  }>;
}

export interface NotificationStatsResult {
  success: boolean;
  stats: NotificationStats;
  error?: string;
  timestamp: number;
}

export class IpcClient {
  private static readonly SOCKET_PATH = PathsUtil.getIpcSocketPath();
  private static readonly CONNECT_TIMEOUT = 3000;

  /**
   * Check if daemon is reachable via IPC
   */
  static async isDaemonReachable(): Promise<boolean> {
    return new Promise((resolve) => {
      const clientId = `lumentui-cli-${Date.now()}`;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.id = clientId;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.retry = 1500;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.silent = true;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.stopRetrying = true;

      let connected = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          resolve(false);
        }
      }, this.CONNECT_TIMEOUT);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('connect', () => {
          connected = true;
          clearTimeout(timeout);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          resolve(true);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    });
  }

  /**
   * Send force-poll command to daemon
   */
  static async forcePoll(): Promise<boolean> {
    return new Promise((resolve) => {
      const clientId = `lumentui-cli-${Date.now()}`;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.id = clientId;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.retry = 1500;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.silent = true;

      const timeout = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.disconnect(clientId);
        resolve(false);
      }, this.CONNECT_TIMEOUT);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('connect', () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.of[clientId].emit('force-poll', {});
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('force-poll-received', () => {
          clearTimeout(timeout);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          resolve(true);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('error', () => {
          clearTimeout(timeout);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          resolve(false);
        });
      });
    });
  }

  /**
   * Wait for daemon to be ready (IPC server listening)
   */
  static async waitForDaemon(
    maxWaitMs: number = 5000,
    checkIntervalMs: number = 100,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.isDaemonReachable()) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    return false;
  }

  /**
   * Get notification history with optional filters
   */
  static async getNotificationHistory(
    filters?: NotificationHistoryFilters,
  ): Promise<NotificationHistoryResult> {
    return new Promise((resolve, reject) => {
      const clientId = `lumentui-cli-${Date.now()}`;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.id = clientId;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.retry = 1500;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.silent = true;

      const timeout = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.disconnect(clientId);
        reject(new Error('Connection timeout'));
      }, this.CONNECT_TIMEOUT);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('connect', () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.of[clientId].emit('getNotificationHistory', filters || {});
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on(
          'getNotificationHistory-result',
          (result: NotificationHistoryResult) => {
            clearTimeout(timeout);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            ipc.disconnect(clientId);
            resolve(result);
          },
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('error', (error: Error) => {
          clearTimeout(timeout);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          reject(error);
        });
      });
    });
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(): Promise<NotificationStatsResult> {
    return new Promise((resolve, reject) => {
      const clientId = `lumentui-cli-${Date.now()}`;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.id = clientId;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.retry = 1500;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ipc.config.silent = true;

      const timeout = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.disconnect(clientId);
        reject(new Error('Connection timeout'));
      }, this.CONNECT_TIMEOUT);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('connect', () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.of[clientId].emit('getNotificationStats', {});
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on(
          'getNotificationStats-result',
          (result: NotificationStatsResult) => {
            clearTimeout(timeout);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            ipc.disconnect(clientId);
            resolve(result);
          },
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ipc.of[clientId].on('error', (error: Error) => {
          clearTimeout(timeout);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ipc.disconnect(clientId);
          reject(error);
        });
      });
    });
  }
}
