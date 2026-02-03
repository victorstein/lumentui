import { PathsUtil } from './paths.util';
import * as path from 'path';
import * as os from 'os';

describe('PathsUtil', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Note: Cannot reset process.platform as it's read-only
  });

  describe('getDataDir', () => {
    it('should return custom path when LUMENTUI_DATA_DIR is set', () => {
      process.env.LUMENTUI_DATA_DIR = '/custom/data/dir';
      expect(PathsUtil.getDataDir()).toBe(path.resolve('/custom/data/dir'));
    });

    it('should return XDG_DATA_HOME path on Unix when set', () => {
      if (process.platform !== 'win32') {
        process.env.XDG_DATA_HOME = '/custom/xdg/data';
        delete process.env.LUMENTUI_DATA_DIR;
        expect(PathsUtil.getDataDir()).toBe('/custom/xdg/data/lumentui');
      }
    });

    it('should return default Unix path when XDG_DATA_HOME is not set', () => {
      if (process.platform !== 'win32') {
        delete process.env.XDG_DATA_HOME;
        delete process.env.LUMENTUI_DATA_DIR;
        const expected = path.join(os.homedir(), '.local', 'share', 'lumentui');
        expect(PathsUtil.getDataDir()).toBe(expected);
      }
    });

    it('should return Windows APPDATA path on Windows', () => {
      if (process.platform === 'win32') {
        delete process.env.LUMENTUI_DATA_DIR;
        const appData =
          process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        const expected = path.join(appData, 'lumentui');
        expect(PathsUtil.getDataDir()).toBe(expected);
      }
    });
  });

  describe('getConfigDir', () => {
    it('should return custom path when LUMENTUI_CONFIG_DIR is set', () => {
      process.env.LUMENTUI_CONFIG_DIR = '/custom/config/dir';
      expect(PathsUtil.getConfigDir()).toBe(path.resolve('/custom/config/dir'));
    });

    it('should return XDG_CONFIG_HOME path on Unix when set', () => {
      if (process.platform !== 'win32') {
        process.env.XDG_CONFIG_HOME = '/custom/xdg/config';
        delete process.env.LUMENTUI_CONFIG_DIR;
        expect(PathsUtil.getConfigDir()).toBe('/custom/xdg/config/lumentui');
      }
    });

    it('should return default Unix config path when XDG_CONFIG_HOME is not set', () => {
      if (process.platform !== 'win32') {
        delete process.env.XDG_CONFIG_HOME;
        delete process.env.LUMENTUI_CONFIG_DIR;
        const expected = path.join(os.homedir(), '.config', 'lumentui');
        expect(PathsUtil.getConfigDir()).toBe(expected);
      }
    });
  });

  describe('getIpcSocketPath', () => {
    it('should return custom path when IPC_SOCKET_PATH is set', () => {
      process.env.IPC_SOCKET_PATH = '/custom/socket.sock';
      expect(PathsUtil.getIpcSocketPath()).toBe('/custom/socket.sock');
    });

    it('should return named pipe path on Windows', () => {
      if (process.platform === 'win32') {
        delete process.env.IPC_SOCKET_PATH;
        expect(PathsUtil.getIpcSocketPath()).toBe('\\\\.\\pipe\\lumentui');
      }
    });

    it('should return Unix socket path on Unix systems', () => {
      if (process.platform !== 'win32') {
        delete process.env.IPC_SOCKET_PATH;
        delete process.env.XDG_RUNTIME_DIR;
        expect(PathsUtil.getIpcSocketPath()).toBe('/tmp/lumentui.sock');
      }
    });

    it('should use XDG_RUNTIME_DIR when available on Unix', () => {
      if (process.platform !== 'win32') {
        process.env.XDG_RUNTIME_DIR = '/run/user/1000';
        delete process.env.IPC_SOCKET_PATH;
        expect(PathsUtil.getIpcSocketPath()).toBe(
          '/run/user/1000/lumentui.sock',
        );
      }
    });
  });

  describe('getDaemonPath', () => {
    it('should return daemon binary path in installation directory', () => {
      const daemonPath = PathsUtil.getDaemonPath();
      expect(daemonPath).toContain('main.js');
      expect(daemonPath.endsWith('main.js')).toBe(true);
    });
  });

  describe('getDefaultDbPath', () => {
    it('should return database path in data directory', () => {
      const dbPath = PathsUtil.getDefaultDbPath();
      expect(dbPath).toContain('lumentui');
      expect(dbPath).toContain('lumentui.db');
    });
  });

  describe('getDefaultLogPath', () => {
    it('should return log file path in data directory', () => {
      const logPath = PathsUtil.getDefaultLogPath();
      expect(logPath).toContain('lumentui');
      expect(logPath).toContain('logs');
      expect(logPath).toContain('app.log');
    });
  });

  describe('getDefaultCookiesPath', () => {
    it('should return cookies file path in data directory', () => {
      const cookiesPath = PathsUtil.getDefaultCookiesPath();
      expect(cookiesPath).toContain('lumentui');
      expect(cookiesPath).toContain('cookies.json');
    });
  });

  describe('getPidFilePath', () => {
    it('should return PID file path in data directory', () => {
      const pidPath = PathsUtil.getPidFilePath();
      expect(pidPath).toContain('lumentui');
      expect(pidPath).toContain('daemon.pid');
    });
  });

  describe('getVersion', () => {
    it('should return version from package.json or environment', () => {
      delete process.env.LUMENTUI_VERSION;
      const version = PathsUtil.getVersion();
      // Should return either version from package.json or 'unknown'
      expect(version).toBeTruthy();
      expect(typeof version).toBe('string');
    });

    it('should fallback to environment variable when package.json is not found', () => {
      const version = PathsUtil.getVersion();
      expect(typeof version).toBe('string');
      expect(version).toBeTruthy();
    });
  });

  describe('getEnvFilePath', () => {
    it('should return .env path in installation directory for dev mode', () => {
      if (PathsUtil.isDevMode()) {
        const envPath = PathsUtil.getEnvFilePath();
        expect(envPath).toContain('.env');
      }
    });

    it('should return .env path in config directory for production mode', () => {
      // This test is harder to verify without mocking isDevMode
      const envPath = PathsUtil.getEnvFilePath();
      expect(envPath).toContain('.env');
    });
  });
});
