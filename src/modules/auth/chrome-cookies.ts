import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

// Chrome epoch offset: microseconds between 1601-01-01 and 1970-01-01
const CHROME_EPOCH_OFFSET = 11644473600;

export function getChromePassword(): string {
  return execSync(
    'security find-generic-password -w -s "Chrome Safe Storage"',
    { encoding: 'utf8' },
  ).trim();
}

export function deriveKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
}

export function decryptValue(encryptedHex: string, key: Buffer): string {
  if (!encryptedHex || encryptedHex.length === 0) {
    return '';
  }

  // Convert hex string to Buffer
  const encryptedValue = Buffer.from(encryptedHex, 'hex');

  if (encryptedValue.length === 0) {
    return '';
  }

  // v10/v11 prefix means AES-128-CBC encrypted
  const prefix = encryptedValue.slice(0, 3).toString('utf8');
  if (prefix !== 'v10' && prefix !== 'v11') {
    // Unencrypted value
    return encryptedValue.toString('utf8');
  }

  const iv = Buffer.alloc(16, ' ');
  const data = encryptedValue.slice(3);

  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function getChromeDbPath(profile: string = 'Default'): string {
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    profile,
    'Cookies',
  );
}

/**
 * Copy Chrome's cookie DB + WAL/SHM files to a temp directory.
 * The system sqlite3 CLI handles WAL natively when files are co-located.
 */
function copyDbToTemp(cookieDbPath: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumentui-cookies-'));
  const tempDb = path.join(tempDir, 'Cookies');

  fs.copyFileSync(cookieDbPath, tempDb);

  for (const ext of ['-wal', '-shm']) {
    const src = cookieDbPath + ext;
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, tempDb + ext);
    }
  }

  return tempDb;
}

function cleanupTemp(tempDb: string): void {
  try {
    fs.rmSync(path.dirname(tempDb), { recursive: true, force: true });
  } catch {}
}

/**
 * Query Chrome cookie DB using the system sqlite3 CLI.
 * This handles WAL mode natively, unlike in-memory WASM engines.
 */
export async function getCookiesForUrl(
  url: string,
  profile?: string,
): Promise<ChromeCookie[]> {
  const cookieDbPath = getChromeDbPath(profile);

  if (!fs.existsSync(cookieDbPath)) {
    throw new Error(
      `Chrome cookie database not found at: ${cookieDbPath}. Is Chrome installed?`,
    );
  }

  const tempDb = copyDbToTemp(cookieDbPath);

  try {
    const password = getChromePassword();
    const key = deriveKey(password);

    // Parse the URL to get the domain and parent domain
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const parts = domain.split('.');
    const parentDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;

    // Use system sqlite3 CLI — handles WAL mode natively
    const query = `SELECT name, hex(encrypted_value), host_key, path, expires_utc, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%${parentDomain}%';`;

    const result = execSync(`sqlite3 -separator '|' "${tempDb}" "${query}"`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!result) {
      return [];
    }

    return result.split('\n').map((line) => {
      const [
        name,
        encryptedHex,
        hostKey,
        cookiePath,
        expiresUtc,
        isSecure,
        isHttpOnly,
      ] = line.split('|');

      const value = decryptValue(encryptedHex, key);
      const expiresNum = Number(expiresUtc);
      const expires =
        expiresNum > 0
          ? Math.floor(expiresNum / 1000000) - CHROME_EPOCH_OFFSET
          : 0;

      return {
        name,
        value,
        domain: hostKey,
        path: cookiePath,
        expires,
        httpOnly: isHttpOnly === '1',
        secure: isSecure === '1',
      };
    });
  } finally {
    cleanupTemp(tempDb);
  }
}
