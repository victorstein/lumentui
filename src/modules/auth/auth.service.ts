import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { CookieStorageService } from './cookie-storage.service';
import { getCookiesForUrl } from './chrome-cookies';
import { Cookie } from './interfaces/cookie.interface';
import { AuthException } from './exceptions/auth.exception';

@Injectable()
export class AuthService {
  constructor(
    private readonly cookieStorage: CookieStorageService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async extractCookies(url: string): Promise<Cookie[]> {
    this.logger.log(`Extracting cookies for ${url}`, 'AuthService');

    try {
      // Get Chrome profile from config, default to 'Default'
      const profile =
        this.configService.get<string>('CHROME_PROFILE') || 'Default';

      // Extract cookies from Chrome — try the given URL first,
      // then fall back to the clevertech.biz alias (same Shopify store)
      const urls = [url, 'https://shop.clevertech.biz'];
      let sessionCookies: Cookie[] = [];

      for (const tryUrl of urls) {
        const cookies = await getCookiesForUrl(tryUrl, profile);
        sessionCookies = cookies.filter((c) => c.name === '_shopify_essential');
        if (sessionCookies.length > 0) break;
      }

      if (sessionCookies.length === 0) {
        throw new AuthException(
          'Authentication cookie not found. Please log in to shop.lumenalta.com in Chrome first.',
        );
      }

      this.logger.log(
        `Extracted ${sessionCookies.length} cookie(s): ${sessionCookies.map((c) => c.name).join(', ')}`,
        'AuthService',
      );
      return sessionCookies;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Failed to extract cookies', errorStack, 'AuthService');

      // FIX #3: Wrap error con contexto user-friendly
      if (error instanceof AuthException) {
        throw error;
      }

      if (
        errorMessage.includes('Keychain') ||
        errorMessage.includes('access')
      ) {
        throw new AuthException(
          'Failed to access Chrome Keychain. Please grant permission when prompted.',
        );
      }

      throw new AuthException(`Cookie extraction failed: ${errorMessage}`);
    }
  }

  saveCookies(cookies: Cookie[]): void {
    this.logger.log('Saving cookies to storage', 'AuthService');

    try {
      // Store full Cookie objects with expiration metadata
      this.cookieStorage.saveCookies(cookies);

      this.logger.log('Cookies saved successfully', 'AuthService');
    } catch (error: unknown) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to save cookies', errorStack, 'AuthService');
      throw new AuthException('Failed to save cookies');
    }
  }

  loadCookies(): string {
    this.logger.log('Loading cookies from storage', 'AuthService');

    try {
      // Load full Cookie objects with expiration metadata
      const cookies = this.cookieStorage.loadCookies();

      if (!cookies || cookies.length === 0) {
        throw new AuthException('No cookies found. Please run: lumentui login');
      }

      // Convert to Cookie header format for API calls
      const cookieHeader = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      this.logger.log(
        'Cookies loaded and validated successfully',
        'AuthService',
      );
      return cookieHeader;
    } catch (error: unknown) {
      if (error instanceof AuthException) {
        throw error;
      }

      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to load cookies', errorStack, 'AuthService');
      throw new AuthException('No cookies found. Please run: lumentui login');
    }
  }

  /**
   * Check if a cookie is expired
   * @param cookie Cookie object
   * @returns true if cookie is expired, false otherwise
   */
  validateCookies(): boolean {
    try {
      const cookieHeader = this.loadCookies();
      return !!cookieHeader;
    } catch {
      return false;
    }
  }

  logout(): boolean {
    this.logger.log('Clearing stored cookies', 'AuthService');
    return this.cookieStorage.clearCookies();
  }
}
