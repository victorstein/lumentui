import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Centralized path resolution utility for LumenTUI
 * Handles different installation scenarios:
 * - Development (running from repo)
 * - Homebrew installation
 * - Global npm installation
 */
export class PathsUtil {
  /**
   * Get the installation directory (where the compiled binaries are)
   * This works for both development and installed packages
   */
  static getInstallDir(): string {
    // __dirname in compiled code points to dist/
    // For development: /path/to/repo/dist
    // For Homebrew: /opt/homebrew/lib/node_modules/lumentui/dist (or similar)
    // For npm global: /usr/local/lib/node_modules/lumentui/dist (or similar)
    return path.resolve(__dirname, '..');
  }

  /**
   * Get the daemon binary path
   * Looks in the installation directory
   */
  static getDaemonPath(): string {
    const installDir = this.getInstallDir();
    return path.join(installDir, 'dist', 'main.js');
  }

  /**
   * Get the user data directory
   * Uses platform-specific conventions:
   * - macOS/Linux: ~/.local/share/lumentui or $XDG_DATA_HOME/lumentui
   * - Windows: %APPDATA%/lumentui
   *
   * Can be overridden with LUMENTUI_DATA_DIR environment variable
   */
  static getDataDir(): string {
    // Allow override via environment variable
    const envDataDir = process.env.LUMENTUI_DATA_DIR;
    if (envDataDir) {
      return path.resolve(envDataDir);
    }

    // Use platform-specific defaults
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: %APPDATA%/lumentui
      const appData =
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'lumentui');
    } else {
      // macOS/Linux: $XDG_DATA_HOME/lumentui or ~/.local/share/lumentui
      const xdgDataHome =
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      return path.join(xdgDataHome, 'lumentui');
    }
  }

  /**
   * Get the config directory
   * Uses platform-specific conventions:
   * - macOS/Linux: ~/.config/lumentui or $XDG_CONFIG_HOME/lumentui
   * - Windows: %APPDATA%/lumentui
   *
   * Can be overridden with LUMENTUI_CONFIG_DIR environment variable
   */
  static getConfigDir(): string {
    // Allow override via environment variable
    const envConfigDir = process.env.LUMENTUI_CONFIG_DIR;
    if (envConfigDir) {
      return path.resolve(envConfigDir);
    }

    // Use platform-specific defaults
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: %APPDATA%/lumentui (same as data dir)
      const appData =
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'lumentui');
    } else {
      // macOS/Linux: $XDG_CONFIG_HOME/lumentui or ~/.config/lumentui
      const xdgConfigHome =
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      return path.join(xdgConfigHome, 'lumentui');
    }
  }

  /**
   * Get the IPC socket path
   * Uses platform-specific conventions:
   * - Unix (macOS/Linux): /tmp/lumentui.sock or $XDG_RUNTIME_DIR/lumentui.sock
   * - Windows: \\.\pipe\lumentui (named pipe)
   *
   * Can be overridden with IPC_SOCKET_PATH environment variable
   */
  static getIpcSocketPath(): string {
    // Allow override via environment variable
    const envSocketPath = process.env.IPC_SOCKET_PATH;
    if (envSocketPath) {
      return envSocketPath;
    }

    // Use platform-specific defaults
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: named pipe
      return '\\\\.\\pipe\\lumentui';
    } else {
      // macOS/Linux: Unix socket
      // Prefer XDG_RUNTIME_DIR if available, otherwise use /tmp
      const runtimeDir = process.env.XDG_RUNTIME_DIR || '/tmp';
      return path.join(runtimeDir, 'lumentui.sock');
    }
  }

  /**
   * Get the path for PID file
   */
  static getPidFilePath(): string {
    return path.join(this.getDataDir(), 'daemon.pid');
  }

  /**
   * Get the default database path
   */
  static getDefaultDbPath(): string {
    return path.join(this.getDataDir(), 'lumentui.db');
  }

  /**
   * Get the default log file path
   */
  static getDefaultLogPath(): string {
    return path.join(this.getDataDir(), 'logs', 'app.log');
  }

  /**
   * Get the default cookies file path
   */
  static getDefaultCookiesPath(): string {
    return path.join(this.getDataDir(), 'cookies.json');
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Check if running in development mode (from repo)
   * Development mode is detected when package.json exists in install dir
   */
  static isDevMode(): boolean {
    const installDir = this.getInstallDir();
    const packageJsonPath = path.join(installDir, 'package.json');
    return fs.existsSync(packageJsonPath);
  }

  /**
   * Get the .env file path
   * In development: looks for .env in repo root
   * In production: looks for .env in config directory
   */
  static getEnvFilePath(): string {
    if (this.isDevMode()) {
      // Development: use .env in repo root
      const installDir = this.getInstallDir();
      return path.join(installDir, '.env');
    } else {
      // Production: use .env in config directory
      return path.join(this.getConfigDir(), '.env');
    }
  }

  /**
   * Get package version
   * Tries to read from bundled package.json, falls back to environment variable
   */
  static getVersion(): string {
    try {
      const installDir = this.getInstallDir();
      const packageJsonPath = path.join(installDir, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const packageJson = require(packageJsonPath) as { version: string };
        return packageJson.version;
      }
    } catch {
      // Fall through to environment variable
    }

    // Fallback to environment variable or unknown
    return process.env.LUMENTUI_VERSION || 'unknown';
  }
}
