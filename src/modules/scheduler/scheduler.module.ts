import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { ApiModule } from '../api/api.module';
import { StorageModule } from '../storage/storage.module';
import { IpcModule } from '../ipc/ipc.module';
import { NotificationModule } from '../notification/notification.module';
import { DifferModule } from '../differ/differ.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiModule,
    StorageModule, // Already global, but explicit for clarity
    IpcModule,
    NotificationModule,
    DifferModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
