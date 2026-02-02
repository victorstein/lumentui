import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { machineIdSync } from 'node-machine-id';
import { Cookie } from './interfaces/cookie.interface';

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
  private readonly STORAGE_DIR = join(homedir(), '.lumentui');
  private readonly COOKIE_FILE = join(this.STORAGE_DIR, 'cookies.enc');
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly STORAGE_VERSION = 2; // Version 2: stores full Cookie objects

  constructor(private readonly configService: ConfigService) {
    // Ensure storage directory exists
    if (!existsSync(this.STORAGE_DIR)) {
      mkdirSync(this.STORAGE_DIR, { recursive: true });
    }
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
      const stored = JSON.parse(readFileSync(this.COOKIE_FILE, 'utf8'));
      const key = this.getEncryptionKey();
      const iv = Buffer.from(stored.iv, 'hex');
      const authTag = Buffer.from(stored.authTag, 'hex');

      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(stored.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Check if this is the new format (v2) or old format (v1)
      const parsed = JSON.parse(decrypted);
      
      if (parsed.version === this.STORAGE_VERSION) {
        // New format with full Cookie objects
        return parsed.cookies as Cookie[];
      } else if (typeof parsed === 'string' || !parsed.version) {
        // Old format (v1): just a cookie header string
        // Return null to force re-authentication
        return null;
      }

      return parsed.cookies as Cookie[];
    } catch (error) {
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
}
