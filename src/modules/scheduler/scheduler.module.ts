import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { ApiModule } from '../api/api.module';
import { StorageModule } from '../storage/storage.module';
import { IpcModule } from '../ipc/ipc.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiModule,
    StorageModule, // Already global, but explicit for clarity
    IpcModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
