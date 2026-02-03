import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiModule } from './modules/api/api.module';
import { StorageModule } from './modules/storage/storage.module';

/**
 * Lightweight module for CLI commands.
 * Excludes IPC, Scheduler, and Notification modules to avoid
 * conflicting with a running daemon process.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    AuthModule,
    ApiModule,
    StorageModule,
  ],
})
export class CliModule {}
