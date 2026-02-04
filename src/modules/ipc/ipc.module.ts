import { Module } from '@nestjs/common';
import { IpcGateway } from './ipc.gateway';
import { NotificationModule } from '../notification/notification.module';

/**
 * IPC Module
 * Provides Unix socket communication between daemon and TUI client
 */
@Module({
  imports: [NotificationModule],
  providers: [IpcGateway],
  exports: [IpcGateway],
})
export class IpcModule {}
