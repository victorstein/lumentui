import * as ipcModule from 'node-ipc';
const ipc = (ipcModule as any).default || ipcModule;

export class IpcClient {
  private static readonly SOCKET_PATH = '/tmp/lumentui.sock';
  private static readonly CONNECT_TIMEOUT = 3000;

  /**
   * Check if daemon is reachable via IPC
   */
  static async isDaemonReachable(): Promise<boolean> {
    return new Promise((resolve) => {
      const clientId = `lumentui-cli-${Date.now()}`;

      ipc.config.id = clientId;
      ipc.config.retry = 1500;
      ipc.config.silent = true;
      ipc.config.stopRetrying = true;

      let connected = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          ipc.disconnect(clientId);
          resolve(false);
        }
      }, this.CONNECT_TIMEOUT);

      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        ipc.of[clientId].on('connect', () => {
          connected = true;
          clearTimeout(timeout);
          ipc.disconnect(clientId);
          resolve(true);
        });

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

      ipc.config.id = clientId;
      ipc.config.retry = 1500;
      ipc.config.silent = true;

      const timeout = setTimeout(() => {
        ipc.disconnect(clientId);
        resolve(false);
      }, this.CONNECT_TIMEOUT);

      ipc.connectTo(clientId, this.SOCKET_PATH, () => {
        ipc.of[clientId].on('connect', () => {
          ipc.of[clientId].emit('force-poll', {});
        });

        ipc.of[clientId].on('force-poll-received', () => {
          clearTimeout(timeout);
          ipc.disconnect(clientId);
          resolve(true);
        });

        ipc.of[clientId].on('error', () => {
          clearTimeout(timeout);
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
}
