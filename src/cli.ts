#!/usr/bin/env node

import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { spawn } from 'child_process';
import { AuthService } from './modules/auth/auth.service';
import { ShopifyService } from './modules/api/shopify/shopify.service';
import { CliModule } from './cli.module';
import { PidManager } from './common/utils/pid.util';
import { IpcClient } from './common/utils/ipc-client.util';
import { DatabaseService } from './modules/storage/database/database.service';
import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require(path.resolve(__dirname, '..', 'package.json')) as {
  version: string;
};

// Suppress console logs in CLI mode (logs still go to file)
process.env.LUMENTUI_CLI_MODE = '1';

// Helper: force real ESM import() from CJS context.
// TypeScript compiles `await import('x')` to `require('x')` in CommonJS,
// which fails for ESM-only packages like Ink 5. This bypasses that.
const esmImport = (specifier: string) =>
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  new Function('s', 'return import(s)')(specifier);

const program = new Command();

/**
 * Validation helpers
 */
class CliValidator {
  /**
   * Validate numeric environment variable
   * @param value String value from env
   * @param name Variable name
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   */
  static validateNumeric(
    value: string | undefined,
    name: string,
    min?: number,
    max?: number,
  ): { valid: boolean; error?: string } {
    if (!value) {
      return { valid: true }; // Optional field
    }

    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        valid: false,
        error: `${name} must be a valid number (got: "${value}")`,
      };
    }

    if (min !== undefined && num < min) {
      return {
        valid: false,
        error: `${name} must be at least ${min} (got: ${num})`,
      };
    }

    if (max !== undefined && num > max) {
      return {
        valid: false,
        error: `${name} must be at most ${max} (got: ${num})`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate file path accessibility
   * @param filePath Path to validate
   * @param shouldExist Whether file must exist
   * @param shouldBeWritable Whether file/directory must be writable
   */
  static validateFilePath(
    filePath: string,
    options: {
      shouldExist?: boolean;
      shouldBeWritable?: boolean;
      name?: string;
    } = {},
  ): { valid: boolean; error?: string } {
    const name = options.name || 'File path';

    if (options.shouldExist && !fs.existsSync(filePath)) {
      return {
        valid: false,
        error: `${name} does not exist: ${filePath}`,
      };
    }

    if (options.shouldBeWritable) {
      // Check if parent directory is writable
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        return {
          valid: false,
          error: `${name} parent directory does not exist: ${dir}`,
        };
      }

      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch {
        return {
          valid: false,
          error: `${name} directory is not writable: ${dir}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate configuration from environment variables
   */
  static validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate poll interval
    const pollInterval = process.env.LUMENTUI_POLL_INTERVAL;
    const pollResult = this.validateNumeric(
      pollInterval,
      'LUMENTUI_POLL_INTERVAL',
      10,
      86400,
    );
    if (!pollResult.valid) {
      errors.push(pollResult.error!);
    }

    // Validate timeout
    const timeout = process.env.SHOPIFY_TIMEOUT_MS;
    const timeoutResult = this.validateNumeric(
      timeout,
      'SHOPIFY_TIMEOUT_MS',
      1000,
      60000,
    );
    if (!timeoutResult.valid) {
      errors.push(timeoutResult.error!);
    }

    // Validate database path (parent dir must be writable)
    const dbPath = process.env.DB_PATH || 'data/lumentui.db';
    const dbResult = this.validateFilePath(dbPath, {
      shouldBeWritable: true,
      name: 'DB_PATH',
    });
    if (!dbResult.valid) {
      errors.push(dbResult.error!);
    }

    // Validate log file path (parent dir must be writable)
    const logPath = process.env.LOG_FILE || 'data/logs/app.log';
    const logResult = this.validateFilePath(logPath, {
      shouldBeWritable: true,
      name: 'LOG_FILE',
    });
    if (!logResult.valid) {
      errors.push(logResult.error!);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

program
  .name('lumentui')
  .description('🌟 LumenTUI - Monitor shop.lumenalta.com for new products')
  .version(packageJson.version);

/**
 * Command: lumentui auth
 * Extract cookies from Chrome Keychain and validate
 */
program
  .command('auth')
  .description('Authenticate with shop.lumenalta.com')
  .option('--check', 'Verify current session')
  .action(async (options: { check?: boolean }) => {
    try {
      // Bootstrap NestJS app to get AuthService
      const app = await NestFactory.createApplicationContext(CliModule, {
        logger: false,
      });

      const authService = app.get(AuthService);
      const shopifyService = app.get(ShopifyService);

      if (options.check) {
        // Check if cookies exist and actually work
        try {
          await shopifyService.getProducts();
          console.log('✅ Session is valid');
          process.exit(0);
        } catch {
          console.log('❌ No valid session. Run: lumentui auth');
          process.exit(1);
        }
      } else {
        const url = 'https://shop.lumenalta.com';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
        const { execSync } = require('child_process');

        // Render Ink AuthFlow component (ESM dynamic import)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const React = await esmImport('react');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { render } = await esmImport('ink');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const AuthFlowModule = await esmImport(
          path.resolve(__dirname, 'ui/components/AuthFlow.js'),
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        render(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          React.createElement(AuthFlowModule.AuthFlow, {
            extractCookies: () => authService.extractCookies(url),

            saveCookies: (cookies: unknown) =>
              authService.saveCookies(
                cookies as import('./modules/auth/interfaces/cookie.interface').Cookie[],
              ),

            testSession: async () => {
              try {
                await shopifyService.getProducts();
                return true;
              } catch {
                return false;
              }
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            openBrowser: () => execSync(`open "${url}"`),
          }),
        );
      }

      await app.close();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Authentication failed:', errorMessage);
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
  .action(async (options: { daemonOnly?: boolean }) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const React = await esmImport('react');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { render } = await esmImport('ink');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const StartFlowModule = await esmImport(
        path.resolve(__dirname, 'ui/components/StartFlow.js'),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      render(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        React.createElement(StartFlowModule.StartFlow, {
          daemonOnly: !!options.daemonOnly,
          validateConfig: () => CliValidator.validateEnvironment(),
          getDaemonStatus: () => PidManager.getDaemonStatus(),
          ensureDataDir: () => PidManager.ensureDataDir(),
          getDaemonPath: () => {
            const daemonPath = path.join(process.cwd(), 'dist', 'main.js');
            const result = CliValidator.validateFilePath(daemonPath, {
              shouldExist: true,
              name: 'Daemon binary',
            });
            return {
              valid: result.valid,
              path: daemonPath,
              error: result.error,
            };
          },
          spawnDaemon: (daemonPath: string) => {
            const daemon = spawn('node', [daemonPath], {
              detached: true,
              stdio: 'ignore',
              env: process.env,
            });
            daemon.unref();
            PidManager.savePid(daemon.pid!);
            return { pid: daemon.pid! };
          },
          waitForDaemon: () => IpcClient.waitForDaemon(5000),
          launchTui: async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const AppModule = await esmImport(
              path.resolve(__dirname, 'ui/App.js'),
            );
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            render(React.createElement(AppModule.default));
          },
        }),
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to start:', errorMessage);
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
  .action(async (options: { force?: boolean }) => {
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to stop daemon:', errorMessage);
      process.exit(1);
    }
  });

/**
 * Command: lumentui logout
 * Clear stored authentication cookies
 */
program
  .command('logout')
  .description('Clear stored authentication cookies')
  .action(async () => {
    try {
      const app = await NestFactory.createApplicationContext(CliModule, {
        logger: false,
      });
      const authService = app.get(AuthService);
      const cleared = authService.logout();

      if (cleared) {
        console.log('✅ Logged out successfully. Cookies cleared.');
      } else {
        console.log('ℹ️  No stored cookies found.');
      }
      process.exit(0);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Logout failed:', errorMessage);
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const React = await esmImport('react');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { render } = await esmImport('ink');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const StatusViewModule = await esmImport(
        path.resolve(__dirname, 'ui/components/StatusView.js'),
      );

      const daemonStatus = PidManager.getDaemonStatus();
      let ipcReachable: boolean | null = null;
      let lastPoll: unknown = null;

      // Render initial loading state
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const { rerender } = render(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        React.createElement(StatusViewModule.StatusView, {
          daemonStatus,
          ipcReachable: daemonStatus.isRunning ? null : false,
          lastPoll: null,
          loading: daemonStatus.isRunning,
        }),
      );

      if (daemonStatus.isRunning) {
        // Check IPC
        ipcReachable = await IpcClient.isDaemonReachable();

        // Fetch poll data
        try {
          const nestApp = await NestFactory.createApplicationContext(
            CliModule,
            { logger: false },
          );
          const dbService = nestApp.get(DatabaseService);
          const polls = dbService.getPolls(1);
          if (polls.length > 0) {
            lastPoll = polls[0];
          }
          await nestApp.close();
        } catch {
          // Could not fetch poll info
        }

        // Re-render with data
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        rerender(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          React.createElement(StatusViewModule.StatusView, {
            daemonStatus,
            ipcReachable,
            lastPoll,
            loading: false,
          }),
        );
      }

      process.exit(0);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to get status:', errorMessage);
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
  .action((options: { follow?: boolean; lines: string }) => {
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const logEntry = JSON.parse(line);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-member-access
          const level = logEntry.level.toUpperCase().padEnd(5);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
                const newLines = chunk
                  .toString()
                  .split('\n')
                  .filter((l) => l.trim());
                newLines.forEach((line) => {
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const logEntry = JSON.parse(line);
                    const timestamp = new Date(
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                      logEntry.timestamp,
                    ).toLocaleTimeString();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-member-access
                    const level = logEntry.level.toUpperCase().padEnd(5);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to read logs:', errorMessage);
      process.exit(1);
    }
  });

/**
 * Command: lumentui config
 * Manage configuration settings
 */
const configCommand = program
  .command('config')
  .description('Manage configuration settings');

/**
 * Config utilities
 */
class ConfigManager {
  private static readonly ENV_FILE = path.join(process.cwd(), '.env');

  // Known configuration keys with validation rules
  private static readonly CONFIG_SCHEMA: Record<
    string,
    {
      description: string;
      validator?: (value: string) => { valid: boolean; error?: string };
      sensitive?: boolean;
    }
  > = {
    LUMENTUI_POLL_INTERVAL: {
      description: 'Polling interval in seconds',
      validator: (value) =>
        CliValidator.validateNumeric(
          value,
          'LUMENTUI_POLL_INTERVAL',
          10,
          86400,
        ),
    },
    LUMENTUI_NOTIFY_MIN_PRICE: {
      description: 'Minimum price for notifications',
      validator: (value) =>
        CliValidator.validateNumeric(value, 'LUMENTUI_NOTIFY_MIN_PRICE', 0),
    },
    LUMENTUI_NOTIFY_KEYWORDS: {
      description: 'Comma-separated keywords for filtering notifications',
    },
    LUMENTUI_SHOP_URL: {
      description: 'Shopify shop URL',
    },
    SHOPIFY_TIMEOUT_MS: {
      description: 'API timeout in milliseconds',
      validator: (value) =>
        CliValidator.validateNumeric(value, 'SHOPIFY_TIMEOUT_MS', 1000, 60000),
    },
    LOG_LEVEL: {
      description: 'Log level (debug|info|warn|error)',
      validator: (value) => {
        const valid = ['debug', 'info', 'warn', 'error'].includes(value);
        return valid
          ? { valid: true }
          : { valid: false, error: 'Must be one of: debug, info, warn, error' };
      },
    },
    NOTIFICATION_ENABLED: {
      description: 'Enable/disable notifications',
      validator: (value) => {
        const valid = ['true', 'false'].includes(value.toLowerCase());
        return valid
          ? { valid: true }
          : { valid: false, error: 'Must be true or false' };
      },
    },
  };

  /**
   * Read .env file and parse into key-value pairs
   */
  static readEnvFile(): Record<string, string> {
    if (!fs.existsSync(this.ENV_FILE)) {
      return {};
    }

    const content = fs.readFileSync(this.ENV_FILE, 'utf-8');
    const config: Record<string, string> = {};

    content.split('\n').forEach((line) => {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // Parse KEY=VALUE
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        config[key] = value;
      }
    });

    return config;
  }

  /**
   * Write configuration back to .env file
   */
  static writeEnvFile(config: Record<string, string>): void {
    // Preserve original file structure with comments
    let content = '';

    if (fs.existsSync(this.ENV_FILE)) {
      const originalContent = fs.readFileSync(this.ENV_FILE, 'utf-8');
      const lines = originalContent.split('\n');
      const updatedKeys = new Set<string>();

      lines.forEach((line) => {
        const trimmedLine = line.trim();

        // Keep comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          content += line + '\n';
          return;
        }

        // Update existing keys
        const match = trimmedLine.match(/^([^=]+)=/);
        if (match) {
          const key = match[1].trim();
          if (key in config) {
            content += `${key}=${config[key]}\n`;
            updatedKeys.add(key);
            return;
          }
        }

        // Keep unmodified line
        content += line + '\n';
      });

      // Append new keys that weren't in the original file
      Object.keys(config).forEach((key) => {
        if (!updatedKeys.has(key)) {
          content += `${key}=${config[key]}\n`;
        }
      });
    } else {
      // Create new .env file
      Object.entries(config).forEach(([key, value]) => {
        content += `${key}=${value}\n`;
      });
    }

    fs.writeFileSync(this.ENV_FILE, content, 'utf-8');
  }

  /**
   * Mask sensitive values
   */
  static maskValue(key: string, value: string): string {
    const schema = this.CONFIG_SCHEMA[key];
    if (schema?.sensitive && value) {
      if (value.length <= 4) {
        return '****';
      }
      return '*'.repeat(value.length - 4) + value.slice(-4);
    }
    return value;
  }

  /**
   * Validate a configuration value
   */
  static validateValue(
    key: string,
    value: string,
  ): { valid: boolean; error?: string } {
    const schema = this.CONFIG_SCHEMA[key];

    if (!schema) {
      return {
        valid: false,
        error: `Unknown configuration key: ${key}`,
      };
    }

    if (schema.validator) {
      return schema.validator(value);
    }

    return { valid: true };
  }

  /**
   * Get configuration key description
   */
  static getDescription(key: string): string {
    return this.CONFIG_SCHEMA[key]?.description || 'No description available';
  }

  /**
   * Check if key is known
   */
  static isKnownKey(key: string): boolean {
    return key in this.CONFIG_SCHEMA;
  }
}

/**
 * Subcommand: lumentui config get
 * Display current configuration values
 */
configCommand
  .command('get')
  .description('Display current configuration values')
  .option('-a, --all', 'Show all configuration values (including non-standard)')
  .action((options: { all?: boolean }) => {
    try {
      const config = ConfigManager.readEnvFile();

      if (Object.keys(config).length === 0) {
        console.log(
          'No configuration found. Create a .env file to get started.',
        );
        console.log('See .env.example for reference.');
        process.exit(0);
      }

      console.log('\n Configuration Settings\n');
      console.log(''.padEnd(80, '='));

      // Show key configuration values
      const keysToShow = options.all
        ? Object.keys(config)
        : Object.keys(config).filter((key) => ConfigManager.isKnownKey(key));

      if (keysToShow.length === 0) {
        console.log('\nNo standard configuration keys found.');
        console.log('Use --all flag to see all keys.');
      } else {
        keysToShow.sort().forEach((key) => {
          const value = config[key];
          const maskedValue = ConfigManager.maskValue(key, value);
          const description = ConfigManager.getDescription(key);

          console.log(`\n${key}`);
          console.log(`  Value: ${maskedValue || '(not set)'}`);
          console.log(`  Description: ${description}`);
        });
      }

      console.log('\n' + ''.padEnd(80, '=') + '\n');
      process.exit(0);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to read configuration:', errorMessage);
      process.exit(1);
    }
  });

/**
 * Subcommand: lumentui config set KEY=VALUE
 * Update configuration value
 */
configCommand
  .command('set <keyValue>')
  .description('Set configuration value (format: KEY=VALUE)')
  .action((keyValue: string) => {
    try {
      // Parse KEY=VALUE
      const match = keyValue.match(/^([^=]+)=(.*)$/);
      if (!match) {
        console.error('Invalid format. Use: lumentui config set KEY=VALUE');
        console.error('Example: lumentui config set LUMENTUI_POLL_INTERVAL=60');
        process.exit(1);
      }

      const key = match[1].trim();
      const value = match[2].trim();

      // Validate key
      if (!ConfigManager.isKnownKey(key)) {
        console.error(`Unknown configuration key: ${key}`);
        console.error('\nKnown keys:');
        Object.keys(ConfigManager['CONFIG_SCHEMA'])
          .sort()
          .forEach((k) => {
            console.error(`  - ${k}`);
          });
        process.exit(1);
      }

      // Validate value
      const validation = ConfigManager.validateValue(key, value);
      if (!validation.valid) {
        console.error(`Validation failed: ${validation.error}`);
        process.exit(1);
      }

      // Read current config
      const config = ConfigManager.readEnvFile();

      // Update the key
      const isNewKey = !(key in config);
      config[key] = value;

      // Write back to file
      ConfigManager.writeEnvFile(config);

      // Success message
      if (isNewKey) {
        console.log(`Configuration key added: ${key}`);
      } else {
        console.log(`Configuration updated: ${key}`);
      }

      const maskedValue = ConfigManager.maskValue(key, value);
      console.log(`New value: ${maskedValue}`);
      console.log('\nRestart the daemon for changes to take effect:');
      console.log('  lumentui stop && lumentui start');

      process.exit(0);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update configuration:', errorMessage);
      process.exit(1);
    }
  });

program.parse();
