import * as fs from 'fs';
import * as path from 'path';

export class PidManager {
  private static readonly DATA_DIR = path.join(process.cwd(), 'data');
  private static readonly PID_FILE = path.join(
    PidManager.DATA_DIR,
    'daemon.pid',
  );

  /**
   * Ensure data directory exists
   */
  static ensureDataDir(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }
  }

  /**
   * Save PID to file
   */
  static savePid(pid: number): void {
    this.ensureDataDir();
    fs.writeFileSync(this.PID_FILE, pid.toString(), 'utf-8');
  }

  /**
   * Read PID from file
   * Returns null if file doesn't exist
   */
  static readPid(): number | null {
    if (!fs.existsSync(this.PID_FILE)) {
      return null;
    }

    try {
      const pidStr = fs.readFileSync(this.PID_FILE, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);

      if (isNaN(pid)) {
        return null;
      }

      return pid;
    } catch {
      return null;
    }
  }

  /**
   * Check if process with given PID is running
   */
  static isProcessRunning(pid: number): boolean {
    try {
      // process.kill with signal 0 doesn't kill the process, just checks if it exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Kill process with given PID
   */
  static killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove PID file
   */
  static removePidFile(): void {
    if (fs.existsSync(this.PID_FILE)) {
      fs.unlinkSync(this.PID_FILE);
    }
  }

  /**
   * Get daemon status
   */
  static getDaemonStatus(): {
    isRunning: boolean;
    pid: number | null;
  } {
    const pid = this.readPid();

    if (pid === null) {
      return { isRunning: false, pid: null };
    }

    const isRunning = this.isProcessRunning(pid);

    // Clean up stale PID file
    if (!isRunning) {
      this.removePidFile();
    }

    return { isRunning, pid: isRunning ? pid : null };
  }
}
