import initSqlJs from 'sql.js';
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
    'security find-generic-password -w -s "Chrome Safe Storage" -a "Chrome"',
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

  // v10 prefix means AES-128-CBC encrypted
  const prefix = encryptedValue.slice(0, 3).toString('utf8');
  if (prefix !== 'v10') {
    // Unencrypted value
    return encryptedValue.toString('utf8');
  }

  const iv = Buffer.alloc(16, ' ');
  const data = encryptedValue.slice(3);

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);

  let decrypted = decipher.update(data);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
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
 * Copy Chrome's cookie DB + WAL files to a temp directory.
 * Chrome uses WAL mode, so we need all three files for a consistent read.
 */
function copyDbToTemp(cookieDbPath: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumentui-cookies-'));
  const tempDb = path.join(tempDir, 'Cookies');

  fs.copyFileSync(cookieDbPath, tempDb);

  // Copy WAL and SHM files if they exist (Chrome uses WAL mode)
  const walPath = cookieDbPath + '-wal';
  const shmPath = cookieDbPath + '-shm';
  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, tempDb + '-wal');
  }
  if (fs.existsSync(shmPath)) {
    fs.copyFileSync(shmPath, tempDb + '-shm');
  }

  return tempDb;
}

/**
 * Clean up temp DB directory
 */
function cleanupTemp(tempDb: string): void {
  try {
    const dir = path.dirname(tempDb);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * Query Chrome cookie DB for cookies matching a URL.
 * Returns all matching cookies (not just storefront_digest).
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

    // Initialize sql.js and open the copied DB with WAL support
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(tempDb);
    const db = new SQL.Database(new Uint8Array(fileBuffer));

    // Parse the URL to get the domain and parent domain
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const parts = domain.split('.');
    const parentDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;

    // Query cookies matching the domain or parent domain
    const results = db.exec(
      `
      SELECT name, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
      FROM cookies
      WHERE host_key IN (?, ?, ?, ?)
    `,
      [domain, `.${domain}`, parentDomain, `.${parentDomain}`],
    );

    db.close();

    if (!results.length || !results[0].values.length) {
      return [];
    }

    const columns = results[0].columns;
    const nameIdx = columns.indexOf('name');
    const encIdx = columns.indexOf('encrypted_value');
    const hostIdx = columns.indexOf('host_key');
    const pathIdx = columns.indexOf('path');
    const expiresIdx = columns.indexOf('expires_utc');
    const secureIdx = columns.indexOf('is_secure');
    const httpOnlyIdx = columns.indexOf('is_httponly');

    return results[0].values.map((row) => {
      const encVal = row[encIdx];
      const value = decryptValue(
        Buffer.from(encVal instanceof Uint8Array ? encVal : []),
        key,
      );
      const expiresUtc = Number(row[expiresIdx]);
      const expires =
        expiresUtc > 0
          ? Math.floor(expiresUtc / 1000000) - CHROME_EPOCH_OFFSET
          : 0;

      return {
        name: row[nameIdx] as string,
        value,
        domain: row[hostIdx] as string,
        path: row[pathIdx] as string,
        expires,
        httpOnly: !!row[httpOnlyIdx],
        secure: !!row[secureIdx],
      };
    });
  } finally {
    cleanupTemp(tempDb);
  }
}
