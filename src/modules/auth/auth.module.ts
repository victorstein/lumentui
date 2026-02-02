import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CookieStorageService } from './cookie-storage.service';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [AuthService, CookieStorageService],
  exports: [AuthService],
})
export class AuthModule {}
