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

export function decryptValue(encryptedValue: Buffer, key: Buffer): string {
  if (!encryptedValue || encryptedValue.length === 0) {
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
 * node-sqlite3-wasm has real filesystem access and reads WAL natively.
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
 * Query Chrome cookie DB for cookies matching a URL.
 * Uses node-sqlite3-wasm which has real filesystem access and WAL support.
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

    // Parse the URL to get domain and parent domain
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const parts = domain.split('.');
    const parentDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;

    // Use node-sqlite3-wasm — WASM-based, no native deps, real FS + WAL support
    const { Database } = await import('node-sqlite3-wasm');
    const db = new Database(tempDb, { readOnly: true });

    const rows = db.all(
      `SELECT name, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
       FROM cookies
       WHERE host_key LIKE ?`,
      [`%${parentDomain}%`],
    );

    db.close();

    return rows.map((row: any) => {
      const encVal = row.encrypted_value;
      const value = decryptValue(
        Buffer.from(
          encVal instanceof Uint8Array
            ? encVal
            : typeof encVal === 'object' && encVal?.buffer
              ? encVal
              : [],
        ),
        key,
      );

      const expiresUtc = Number(row.expires_utc);
      const expires =
        expiresUtc > 0
          ? Math.floor(expiresUtc / 1000000) - CHROME_EPOCH_OFFSET
          : 0;

      return {
        name: row.name as string,
        value,
        domain: row.host_key as string,
        path: row.path as string,
        expires,
        httpOnly: row.is_httponly === 1,
        secure: row.is_secure === 1,
      };
    });
  } finally {
    cleanupTemp(tempDb);
  }
}
