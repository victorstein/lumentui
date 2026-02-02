import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as ipc from 'node-ipc';
import { ProductDto } from '../api/dto/product.dto';

/**
 * IPC Gateway using Unix sockets
 * Handles bidirectional communication between daemon and TUI client
 */
@Injectable()
export class IpcGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpcGateway.name);
  private readonly socketPath = '/tmp/lumentui.sock';
  private isServerRunning = false;

  onModuleInit() {
    this.startServer();
  }

  onModuleDestroy() {
    this.stopServer();
  }

  /**
   * Start Unix socket server
   */
  private startServer(): void {
    if (this.isServerRunning) {
      this.logger.warn('IPC server already running');
      return;
    }

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
   * Stop Unix socket server
   */
  private stopServer(): void {
    if (!this.isServerRunning) {
      return;
    }

    ipc.server.stop();
    this.isServerRunning = false;

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

      // Note: Force-poll will be handled by SchedulerService when Phase 7 integration is complete
      // For now, just acknowledge the request
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
