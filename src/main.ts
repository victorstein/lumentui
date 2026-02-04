import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { IpcGateway } from './modules/ipc/ipc.gateway';
import { PidManager } from './common/utils/pid.util';

async function bootstrap() {
  // Create application context (no HTTP server)
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Use custom Winston logger globally
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Initialize the app (starts IPC server and schedulers)
  await app.init();

  logger.log('🌟 LumenTUI Daemon started', 'Bootstrap');

  // Log IPC status
  const ipcGateway = app.get(IpcGateway);
  const ipcStatus = ipcGateway.getStatus();
  logger.log(`IPC server listening at ${ipcStatus.socketPath}`, 'Bootstrap');

  // Create PID file
  PidManager.ensureDataDir();
  PidManager.savePid(process.pid);
  logger.log(`PID file created: ${process.pid}`, 'Bootstrap');

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`, 'Bootstrap');

    // Force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing exit', 'Bootstrap');
      process.exit(1);
    }, 10_000);
    forceExitTimeout.unref();

    await app.close();

    // Remove PID file
    PidManager.removePidFile();

    // Clean up socket file after all modules have finished destroying
    ipcGateway.cleanupSocket();

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGHUP', () => {
    logger.log('Received SIGHUP (terminal closed), ignoring...', 'Bootstrap');
  });

  // Keep process alive
  logger.log('Daemon is running. Press Ctrl+C to stop.', 'Bootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start daemon:', error);
  process.exit(1);
});
