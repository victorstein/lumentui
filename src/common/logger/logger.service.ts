import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const logFile = this.configService.get<string>(
      'LOG_FILE',
      'data/logs/app.log',
    );

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const ctx = context ? `[${context}]` : '';
                const metaStr = Object.keys(meta).length
                  ? JSON.stringify(meta)
                  : '';
                return `${timestamp} ${level} ${ctx} ${message} ${metaStr}`;
              },
            ),
          ),
        }),
        // File transport
        new winston.transports.File({
          filename: logFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context });
  }
}
