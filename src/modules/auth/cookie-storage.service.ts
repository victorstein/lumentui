import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { machineIdSync } from 'node-machine-id';
import { Cookie } from './interfaces/cookie.interface';
import { PathsUtil } from '../../common/utils/paths.util';

/**
 * Cookie storage data structure with metadata
 */
interface CookieStorageData {
  version: number;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  storedAt: number;
}

@Injectable()
export class CookieStorageService {
  private readonly STORAGE_DIR = PathsUtil.getDataDir();
  private readonly COOKIE_FILE = join(this.STORAGE_DIR, 'cookies.enc');
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly STORAGE_VERSION = 2; // Version 2: stores full Cookie objects

  constructor(private readonly configService: ConfigService) {
    PathsUtil.ensureDir(this.STORAGE_DIR);
  }

  private getEncryptionKey(): Buffer {
    // Use machine ID as encryption key (simple, no user password)
    const machineId = machineIdSync();
    return Buffer.from(machineId.padEnd(32, '0').slice(0, 32));
  }

  /**
   * Save cookies with full metadata including expiration
   * @param cookies Array of Cookie objects
   */
  saveCookies(cookies: Cookie[]): void {
    const cookieData: CookieStorageData = {
      version: this.STORAGE_VERSION,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires || 0, // Default to 0 (session cookie) if undefined
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      })),
      storedAt: Date.now(),
    };

    const plaintext = JSON.stringify(cookieData);
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Store: iv + authTag + encrypted
    const data = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
    };

    writeFileSync(this.COOKIE_FILE, JSON.stringify(data), { mode: 0o600 });
  }

  /**
   * Load cookies with full metadata
   * Returns null if no cookies stored or decryption fails
   */
  loadCookies(): Cookie[] | null {
    if (!existsSync(this.COOKIE_FILE)) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const stored = JSON.parse(readFileSync(this.COOKIE_FILE, 'utf8'));
      const key = this.getEncryptionKey();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const iv = Buffer.from(stored.iv, 'hex');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const authTag = Buffer.from(stored.authTag, 'hex');

      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      let decrypted = decipher.update(stored.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Check if this is the new format (v2) or old format (v1)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(decrypted);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (parsed.version === this.STORAGE_VERSION) {
        // New format with full Cookie objects
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return parsed.cookies as Cookie[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      } else if (typeof parsed === 'string' || !parsed.version) {
        // Old format (v1): just a cookie header string
        // Return null to force re-authentication
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return parsed.cookies as Cookie[];
    } catch {
      return null;
    }
  }

  /**
   * Legacy method for backward compatibility
   * Converts cookies to Cookie header format
   */
  loadCookieHeader(): string | null {
    const cookies = this.loadCookies();
    if (!cookies || cookies.length === 0) {
      return null;
    }

    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * Delete stored cookies
   * Returns true if cookies were deleted, false if none existed
   */
  clearCookies(): boolean {
    if (!existsSync(this.COOKIE_FILE)) {
      return false;
    }
    unlinkSync(this.COOKIE_FILE);
    return true;
  }
}
