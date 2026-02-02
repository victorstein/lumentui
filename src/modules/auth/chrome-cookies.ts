import initSqlJs from 'sql.js';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface ChromeCookie {
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

  // Copy the DB to a temp file to avoid locking issues with Chrome
  const tempDb = path.join(os.tmpdir(), `lumentui-cookies-${Date.now()}.db`);
  fs.copyFileSync(cookieDbPath, tempDb);

  try {
    const password = getChromePassword();
    const key = deriveKey(password);

    // Initialize sql.js
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(tempDb);
    const db = new SQL.Database(new Uint8Array(fileBuffer));

    // Parse the URL to get the domain
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;

    // Query cookies matching the domain
    const stmt = db.prepare(
      `
      SELECT name, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
      FROM cookies
      WHERE host_key LIKE ? OR host_key LIKE ?
    `,
    );

    stmt.bind([`%${domain}`, `.${domain}`]);

    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    db.close();

    return rows.map((row) => {
      const value = decryptValue(row.encrypted_value as Buffer, key);
      const expiresUtc = Number(row.expires_utc);
      // Convert Chrome epoch (microseconds since 1601) to Unix epoch (seconds since 1970)
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
        httpOnly: !!row.is_httponly,
        secure: !!row.is_secure,
      };
    });
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempDb);
    } catch {}
  }
}
