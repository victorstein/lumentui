import { Module } from '@nestjs/common';
import { IpcGateway } from './ipc.gateway';

/**
 * IPC Module
 * Provides Unix socket communication between daemon and TUI client
 */
@Module({
  providers: [IpcGateway],
  exports: [IpcGateway],
})
export class IpcModule {}
