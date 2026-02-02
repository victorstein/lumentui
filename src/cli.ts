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

// Suppress console logs in CLI mode (logs still go to file)
process.env.LUMENTUI_CLI_MODE = '1';

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
        logger: false,
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
        const url = 'https://shop.lumenalta.com';

        // First attempt: check if cookie already exists
        let found = false;
        try {
          const cookies = await authService.extractCookies(url);
          await authService.saveCookies(cookies);
          found = true;
        } catch {
          // Cookie not found — will open browser and poll
        }

        if (found) {
          console.log('✅ Authentication successful!');
          console.log('You can now use: lumentui start');
          await app.close();
          process.exit(0);
        }

        // Open browser for the user to authenticate
        console.log('🌐 Opening shop.lumenalta.com in Chrome...');
        console.log('   Please log in, then wait for confirmation.\n');
        const { execSync } = require('child_process');
        execSync(`open "${url}"`);

        // Poll for the cookie for up to 60 seconds
        const POLL_INTERVAL_MS = 3000;
        const MAX_WAIT_MS = 60000;
        const startTime = Date.now();
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frame = 0;

        while (Date.now() - startTime < MAX_WAIT_MS) {
          const remaining = Math.round(
            (MAX_WAIT_MS - (Date.now() - startTime)) / 1000,
          );
          process.stdout.write(
            `\r${frames[frame++ % frames.length]} Waiting for authentication... (${remaining}s remaining)`,
          );

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          try {
            const cookies = await authService.extractCookies(url);
            await authService.saveCookies(cookies);
            process.stdout.write('\r' + ' '.repeat(60) + '\r');
            console.log('✅ Authentication successful!');
            console.log('You can now use: lumentui start');
            await app.close();
            process.exit(0);
          } catch {
            // Not found yet, keep polling
          }
        }

        // Timed out
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        console.log('❌ Authentication timed out.');
        console.log(
          '   Please log in to shop.lumenalta.com in Chrome and try again.',
        );
        await app.close();
        process.exit(1);
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
      // Validate environment configuration
      console.log('🔍 Validating configuration...');
      const validationResult = CliValidator.validateEnvironment();

      if (!validationResult.valid) {
        console.error('❌ Configuration validation failed:\n');
        validationResult.errors.forEach((error) => {
          console.error(`  • ${error}`);
        });
        console.error(
          '\nPlease fix the above errors in your .env file and try again.',
        );
        process.exit(1);
      }

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

      const daemonPathResult = CliValidator.validateFilePath(daemonPath, {
        shouldExist: true,
        name: 'Daemon binary',
      });
      if (!daemonPathResult.valid) {
        console.error(`❌ ${daemonPathResult.error}`);
        console.error('Run: npm run build');
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
        console.log(
          `IPC: ${ipcReachable ? '🟢 Connected' : '🔴 Not responding'}`,
        );

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
            console.log(
              `Status: ${lastPoll.success ? '✅ Success' : '❌ Failed'}`,
            );
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
                const newLines = chunk
                  .toString()
                  .split('\n')
                  .filter((l) => l.trim());
                newLines.forEach((line) => {
                  try {
                    const logEntry = JSON.parse(line);
                    const timestamp = new Date(
                      logEntry.timestamp,
                    ).toLocaleTimeString();
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
  .action((options) => {
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
    } catch (error) {
      console.error('Failed to read configuration:', error.message);
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
    } catch (error) {
      console.error('Failed to update configuration:', error.message);
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
