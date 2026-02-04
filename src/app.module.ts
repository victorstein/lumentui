import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiModule } from './modules/api/api.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { IpcModule } from './modules/ipc/ipc.module';
import { PathsUtil } from './common/utils/paths.util';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: PathsUtil.getEnvFilePath(),
      ignoreEnvFile: !PathsUtil.isDevMode(), // Skip .env file in production if it doesn't exist
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    AuthModule,
    ApiModule,
    StorageModule,
    NotificationModule,
    SchedulerModule,
    IpcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
