#!/usr/bin/env node

import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { spawn } from 'child_process';
import { AuthService } from './modules/auth/auth.service';
import { AppModule } from './app.module';
import { PidManager } from './common/utils/pid.util';
import { IpcClient } from './common/utils/ipc-client.util';
import { DatabaseService } from './modules/storage/database/database.service';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('lumentui')
  .description('🌟 LumenTUI - Monitor shop.lumenalta.com for new products')
  .version('0.1.0');

/**
 * Command: lumentui auth
 * Extract cookies from Chrome Keychain and validate
 */
program
  .command('auth')
  .description('Authenticate with shop.lumenalta.com')
  .option('--check', 'Verify current session')
  .action(async (options) => {
    try {
      // Bootstrap NestJS app to get AuthService
      const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
      });

      const authService = app.get(AuthService);

      if (options.check) {
        // Check if cookies exist and are valid
        const isValid = await authService.validateCookies();

        if (isValid) {
          console.log('✅ Session is valid');
          process.exit(0);
        } else {
          console.log('❌ No valid session. Run: lumentui auth');
          process.exit(1);
        }
      } else {
        // Extract cookies from Chrome Keychain
        console.log('🔐 Extracting cookies from Chrome...');
        console.log(
          '⚠️  macOS will ask for Keychain permission (first time only)',
        );

        const cookies = await authService.extractCookies(
          'https://shop.lumenalta.com',
        );

        // Save cookies
        await authService.saveCookies(cookies);

        console.log('✅ Authentication successful!');
        console.log('You can now use: lumentui start');
      }

      await app.close();
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Command: lumentui start
 * Start daemon process and optionally launch TUI
 */
program
  .command('start')
  .description('Start daemon and TUI')
  .option('--daemon-only', 'Start only daemon (no TUI)')
  .action(async (options) => {
    try {
      // Check if daemon is already running
      const status = PidManager.getDaemonStatus();
      if (status.isRunning) {
        console.log(`❌ Daemon is already running (PID: ${status.pid})`);
        console.log('Use "lumentui stop" to stop it first');
        process.exit(1);
      }

      // Ensure data directory exists
      PidManager.ensureDataDir();

      // Path to compiled daemon
      const daemonPath = path.join(process.cwd(), 'dist', 'main.js');

      if (!fs.existsSync(daemonPath)) {
        console.error('❌ Daemon not built. Run: npm run build');
        process.exit(1);
      }

      console.log('🚀 Starting daemon...');

      // Fork daemon process
      const daemon = spawn('node', [daemonPath], {
        detached: true,
        stdio: options.daemonOnly ? 'ignore' : 'pipe',
        env: process.env,
      });

      // Unref so parent can exit
      daemon.unref();

      // Save PID
      PidManager.savePid(daemon.pid!);

      console.log(`✅ Daemon started (PID: ${daemon.pid})`);

      // Wait for IPC to be ready
      console.log('⏳ Waiting for daemon to be ready...');
      const isReady = await IpcClient.waitForDaemon(5000);

      if (!isReady) {
        console.warn('⚠️  Daemon started but IPC not responding');
        console.log('Check logs at: data/logs/');
        if (!options.daemonOnly) {
          process.exit(1);
        }
      } else {
        console.log('✅ Daemon is ready');
      }

      // Launch TUI if not daemon-only
      if (!options.daemonOnly) {
        console.log('\n📺 Launching TUI...\n');

        // Check if TUI exists
        const tuiPath = path.join(process.cwd(), 'dist', 'ui', 'App.js');
        if (!fs.existsSync(tuiPath)) {
          console.warn('⚠️  TUI not built yet. Run: npm run build');
          console.log('Daemon is running in background.');
          console.log('Use "lumentui status" to check status');
          process.exit(0);
        }

        // Launch TUI (Phase 8 complete!)
        try {
          // @ts-ignore - Dynamic ESM import
          const { render } = await import('ink');
          // @ts-ignore - Dynamic ESM import
          const React = await import('react');
          // @ts-ignore - Dynamic import of built TUI
          const App = await import('./ui/App.js');
          
          // Render the TUI
          render(React.createElement(App.default));
        } catch (tuiError: any) {
          console.error('❌ Failed to launch TUI:', tuiError.message);
          console.log('Daemon is still running in background.');
          console.log('Use "lumentui stop" to stop the daemon');
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Failed to start daemon:', error.message);
      process.exit(1);
    }
  });

/**
 * Command: lumentui stop
 * Stop the running daemon
 */
program
  .command('stop')
  .description('Stop daemon')
  .option('--force', 'Force kill daemon (SIGKILL)')
  .action(async (options) => {
    try {
      const status = PidManager.getDaemonStatus();

      if (!status.isRunning) {
        console.log('⚠️  Daemon is not running');
        // Clean up stale PID file
        PidManager.removePidFile();
        process.exit(0);
      }

      console.log(`🛑 Stopping daemon (PID: ${status.pid})...`);

      const signal = options.force ? 'SIGKILL' : 'SIGTERM';
      const killed = PidManager.killProcess(status.pid!, signal);

      if (!killed) {
        console.error('❌ Failed to stop daemon');
        process.exit(1);
      }

      // Wait a bit for process to exit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify it stopped
      const stillRunning = PidManager.isProcessRunning(status.pid!);
      if (stillRunning) {
        console.warn('⚠️  Daemon did not stop gracefully, forcing...');
        PidManager.killProcess(status.pid!, 'SIGKILL');
      }

      // Remove PID file
      PidManager.removePidFile();

      console.log('✅ Daemon stopped');
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to stop daemon:', error.message);
      process.exit(1);
    }
  });

/**
 * Command: lumentui status
 * Check daemon status and display information
 */
program
  .command('status')
  .description('Check daemon status')
  .action(async () => {
    try {
      const status = PidManager.getDaemonStatus();

      console.log('\n🌟 LumenTUI Status\n');
      console.log(`Daemon: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}`);

      if (status.isRunning) {
        console.log(`PID: ${status.pid}`);

        // Check IPC connection
        const ipcReachable = await IpcClient.isDaemonReachable();
        console.log(`IPC: ${ipcReachable ? '🟢 Connected' : '🔴 Not responding'}`);

        // Get poll information
        try {
          const app = await NestFactory.createApplicationContext(AppModule, {
            logger: false,
          });

          const dbService = app.get(DatabaseService);
          const polls = dbService.getPolls(1);

          if (polls.length > 0) {
            const lastPoll = polls[0];
            const lastPollDate = new Date(lastPoll.timestamp);
            const uptime = Date.now() - lastPoll.timestamp;
            const uptimeStr = formatDuration(uptime);

            console.log(`\nLast Poll: ${lastPollDate.toLocaleString()}`);
            console.log(`Status: ${lastPoll.success ? '✅ Success' : '❌ Failed'}`);
            console.log(`Products: ${lastPoll.product_count}`);
            console.log(`New Products: ${lastPoll.new_products}`);
            console.log(`Duration: ${lastPoll.duration_ms}ms`);
            if (lastPoll.error) {
              console.log(`Error: ${lastPoll.error}`);
            }
          }

          await app.close();
        } catch (error) {
          console.log('\n⚠️  Could not fetch poll information');
        }
      } else {
        console.log('\nUse "lumentui start" to start the daemon');
      }

      console.log('');
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    }
  });

/**
 * Command: lumentui logs
 * Display daemon logs
 */
program
  .command('logs')
  .description('Display daemon logs')
  .option('--follow', 'Follow log output (stream)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    try {
      const logDir = path.join(process.cwd(), 'data', 'logs');
      const logFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.log'));

      if (logFiles.length === 0) {
        console.log('⚠️  No logs found');
        process.exit(0);
      }

      // Get most recent log file
      const latestLog = logFiles
        .map((f) => ({
          name: f,
          path: path.join(logDir, f),
          mtime: fs.statSync(path.join(logDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

      console.log(`📋 Showing logs from: ${latestLog.name}\n`);

      // Read log file
      const logContent = fs.readFileSync(latestLog.path, 'utf-8');
      const logLines = logContent.split('\n').filter((line) => line.trim());

      // Get last N lines
      const numLines = parseInt(options.lines, 10);
      const displayLines = logLines.slice(-numLines);

      displayLines.forEach((line) => {
        try {
          const logEntry = JSON.parse(line);
          const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
          const level = logEntry.level.toUpperCase().padEnd(5);
          const message = logEntry.message;
          console.log(`[${timestamp}] ${level} ${message}`);
        } catch {
          // Not JSON, display as-is
          console.log(line);
        }
      });

      if (options.follow) {
        console.log('\n⏳ Following logs... (Ctrl+C to stop)\n');

        // Watch file for changes
        let lastSize = fs.statSync(latestLog.path).size;

        const watcher = fs.watch(latestLog.path, (eventType) => {
          if (eventType === 'change') {
            const currentSize = fs.statSync(latestLog.path).size;
            if (currentSize > lastSize) {
              const stream = fs.createReadStream(latestLog.path, {
                start: lastSize,
                encoding: 'utf-8',
              });

              stream.on('data', (chunk) => {
                const newLines = chunk.toString().split('\n').filter((l) => l.trim());
                newLines.forEach((line) => {
                  try {
                    const logEntry = JSON.parse(line);
                    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
                    const level = logEntry.level.toUpperCase().padEnd(5);
                    const message = logEntry.message;
                    console.log(`[${timestamp}] ${level} ${message}`);
                  } catch {
                    console.log(line);
                  }
                });
              });

              lastSize = currentSize;
            }
          }
        });

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          console.log('\n✅ Stopped following logs');
          watcher.close();
          process.exit(0);
        });
      }
    } catch (error) {
      console.error('❌ Failed to read logs:', error.message);
      process.exit(1);
    }
  });

/**
 * Helper: Format duration in ms to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

program.parse();
