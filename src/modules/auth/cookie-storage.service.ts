import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { machineIdSync } from 'node-machine-id';

@Injectable()
export class CookieStorageService {
  private readonly STORAGE_DIR = join(homedir(), '.lumentui');
  private readonly COOKIE_FILE = join(this.STORAGE_DIR, 'cookies.enc');
  private readonly ALGORITHM = 'aes-256-gcm';

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

  saveCookies(cookieHeader: string): void {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(cookieHeader, 'utf8', 'hex');
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

  loadCookies(): string | null {
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

      return decrypted;
    } catch (error) {
      return null;
    }
  }
}
