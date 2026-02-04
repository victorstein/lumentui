/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ProductDto } from '../../src/modules/api/dto/product.dto';

/**
 * Mock IPC Gateway for testing
 * Does not start a real Unix socket server
 */
@Injectable()
export class MockIpcGateway {
  private readonly logger = new Logger('MockIpcGateway');
  private isServerRunning = false;
  private events: Array<{ event: string; data: any }> = [];

  async onModuleInit() {
    this.logger.log('Mock IPC server initialized (no real socket)');
    this.isServerRunning = true;
  }

  onModuleDestroy() {
    this.logger.log('Mock IPC server destroyed');
    this.isServerRunning = false;
  }

  setSchedulerService(_schedulerService: any): void {
    // Mock implementation - no-op
  }

  emitHeartbeat(timestamp: number): void {
    this.events.push({ event: 'daemon:heartbeat', data: { timestamp } });
  }

  emitProductsUpdated(products: ProductDto[]): void {
    this.events.push({
      event: 'products:updated',
      data: { products, count: products.length, timestamp: Date.now() },
    });
  }

  emitProductNew(product: ProductDto): void {
    this.events.push({
      event: 'product:new',
      data: { product, timestamp: Date.now() },
    });
  }

  emitError(error: string): void {
    this.events.push({
      event: 'daemon:error',
      data: { error, timestamp: Date.now() },
    });
  }

  emitLog(level: string, message: string): void {
    this.events.push({
      event: 'log',
      data: { level, message, timestamp: Date.now() },
    });
  }

  getStatus(): {
    isRunning: boolean;
    socketPath: string;
  } {
    return {
      isRunning: this.isServerRunning,
      socketPath: '/tmp/lumentui-test.sock',
    };
  }

  // Test helper: get all emitted events
  getEvents(): Array<{ event: string; data: any }> {
    return this.events;
  }

  // Test helper: clear events
  clearEvents(): void {
    this.events = [];
  }
}
