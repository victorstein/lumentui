import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ipcModule from 'node-ipc';
const ipc = (ipcModule as any).default || ipcModule;
import { existsSync, unlinkSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProductDto } from '../api/dto/product.dto';

const execAsync = promisify(exec);

/**
 * IPC Gateway using Unix sockets
 * Handles bidirectional communication between daemon and TUI client
 */
@Injectable()
export class IpcGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpcGateway.name);
  private readonly socketPath: string;
  private isServerRunning = false;
  private schedulerService: any;

  constructor(private readonly configService: ConfigService) {
    this.socketPath = this.configService.get<string>(
      'IPC_SOCKET_PATH',
      '/tmp/lumentui.sock',
    );
  }

  /**
   * Set scheduler service (injected via forwardRef to avoid circular dependency)
   */
  setSchedulerService(
    @Inject(forwardRef(() => 'SchedulerService'))
    schedulerService: any,
  ): void {
    this.schedulerService = schedulerService;
  }

  async onModuleInit() {
    await this.startServer();
  }

  onModuleDestroy() {
    this.stopServer();
  }

  /**
   * Start Unix socket server
   */
  private async startServer(): Promise<void> {
    if (this.isServerRunning) {
      this.logger.warn('IPC server already running');
      return;
    }

    // Clean up stale socket file before starting
    await this.cleanupStaleSocket();

    // Configure node-ipc
    ipc.config.id = 'lumentui-daemon';
    ipc.config.retry = 1500;
    ipc.config.silent = true; // Disable internal logging

    // Start server
    ipc.serve(this.socketPath, () => {
      this.setupEventHandlers();
    });

    ipc.server.start();
    this.isServerRunning = true;

    this.logger.log(`IPC server started at ${this.socketPath}`);
  }

  /**
   * Clean up stale socket file from previous crash/ungraceful shutdown
   * Checks if socket file exists and if any process is actually using it
   */
  private async cleanupStaleSocket(): Promise<void> {
    if (!existsSync(this.socketPath)) {
      // No socket file exists, nothing to clean up
      return;
    }

    this.logger.log('Socket file exists, checking if stale...');

    try {
      // Check if any process is listening on this socket using lsof
      // lsof returns exit code 0 if file is open, non-zero if not
      await execAsync(`lsof ${this.socketPath}`);

      // If we reach here, the socket is in use by another process
      this.logger.warn(
        'Socket file is in use by another process. Cannot start server.',
      );
      throw new Error(
        `IPC socket ${this.socketPath} is already in use by another process`,
      );
    } catch (error: any) {
      // lsof returns non-zero exit code if socket is not in use
      // This means the socket file is stale (no process listening)
      if (error.code === 1 || error.message?.includes('No such')) {
        this.logger.log('Removing stale socket file');
        try {
          unlinkSync(this.socketPath);
          this.logger.log('Stale socket file removed successfully');
        } catch (unlinkError) {
          this.logger.error(
            `Failed to remove stale socket file: ${unlinkError.message}`,
          );
          throw unlinkError;
        }
      } else {
        // Some other error occurred (e.g., lsof not found, permission denied)
        this.logger.error(`Error checking socket status: ${error.message}`);
        // Attempt to remove socket anyway
        try {
          unlinkSync(this.socketPath);
          this.logger.log('Socket file removed (lsof check failed)');
        } catch {
          // Ignore if removal fails
        }
      }
    }
  }

  /**
   * Stop Unix socket server and clean up socket file
   */
  private stopServer(): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.stop();
    this.isServerRunning = false;

    // Clean up socket file on graceful shutdown
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
        this.logger.log('Socket file cleaned up');
      } catch (error: any) {
        this.logger.warn(`Failed to clean up socket file: ${error.message}`);
      }
    }

    this.logger.log('IPC server stopped');
  }

  /**
   * Setup event handlers for client connections
   */
  private setupEventHandlers(): void {
    ipc.server.on('connect', (socket: any) => {
      this.logger.log('TUI client connected');
    });

    ipc.server.on('disconnect', (socket: any) => {
      this.logger.log('TUI client disconnected');
    });

    // Listen for force-poll event from client
    ipc.server.on('force-poll', async (data: any, socket: any) => {
      this.logger.log('Force poll requested by client');

      // Acknowledge receipt
      ipc.server.emit(socket, 'force-poll-received', {
        timestamp: Date.now(),
      });

      // Execute force poll via SchedulerService
      if (this.schedulerService) {
        try {
          const result = await this.schedulerService.forcePoll();

          // Emit result back to client
          ipc.server.emit(socket, 'force-poll-result', {
            success: result.success,
            productCount: result.productCount,
            newProducts: result.newProducts,
            durationMs: result.durationMs,
            error: result.error,
            timestamp: Date.now(),
          });

          this.logger.log(
            `Force poll completed: ${result.success ? 'success' : 'failed'}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Force poll failed: ${errorMessage}`, error.stack);

          // Emit error back to client
          ipc.server.emit(socket, 'force-poll-result', {
            success: false,
            productCount: 0,
            newProducts: 0,
            durationMs: 0,
            error: errorMessage,
            timestamp: Date.now(),
          });
        }
      } else {
        this.logger.warn('SchedulerService not available, cannot force poll');

        // Emit error back to client
        ipc.server.emit(socket, 'force-poll-result', {
          success: false,
          productCount: 0,
          newProducts: 0,
          durationMs: 0,
          error: 'SchedulerService not available',
          timestamp: Date.now(),
        });
      }
    });

    ipc.server.on('error', (error: Error) => {
      this.logger.error(`IPC server error: ${error.message}`, error.stack);
    });
  }

  /**
   * Emit heartbeat event to all connected clients
   * Should be called at the end of each poll
   */
  emitHeartbeat(timestamp: number): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.broadcast('daemon:heartbeat', {
      timestamp,
    });

    this.logger.debug(`Heartbeat emitted: ${timestamp}`);
  }

  /**
   * Emit products updated event to all connected clients
   * Should be called after saving products to database
   */
  emitProductsUpdated(products: ProductDto[]): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.broadcast('products:updated', {
      products,
      count: products.length,
      timestamp: Date.now(),
    });

    this.logger.debug(`Products updated emitted: ${products.length} products`);
  }

  /**
   * Emit new product event to all connected clients
   * Should be called when a new product is detected
   */
  emitProductNew(product: ProductDto): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.broadcast('product:new', {
      product,
      timestamp: Date.now(),
    });

    this.logger.log(`New product emitted: ${product.title}`);
  }

  /**
   * Emit error event to all connected clients
   * Should be called when poll or other operations fail
   */
  emitError(error: string): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.broadcast('daemon:error', {
      error,
      timestamp: Date.now(),
    });

    this.logger.error(`Error emitted: ${error}`);
  }

  /**
   * Emit log event to all connected clients
   * Can be used for real-time log streaming to TUI
   */
  emitLog(level: string, message: string): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.broadcast('log', {
      level,
      message,
      timestamp: Date.now(),
    });

    this.logger.debug(`Log emitted: [${level}] ${message}`);
  }

  /**
   * Get server status
   */
  getStatus(): {
    isRunning: boolean;
    socketPath: string;
  } {
    return {
      isRunning: this.isServerRunning,
      socketPath: this.socketPath,
    };
  }
}
