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

      // Extract cookies from Chrome
      const cookies = await getCookiesForUrl(url, profile);

      // Filter for Shopify session cookies needed for authenticated access
      const sessionCookieNames = [
        '_shopify_essential',
        '_shopify_y',
        'storefront_digest',
      ];
      const sessionCookies = cookies.filter((c) =>
        sessionCookieNames.includes(c.name),
      );

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
        throw new AuthException('No cookies found. Please run: lumentui auth');
      }

      // Validate cookie expiration
      const expiredCookies = cookies.filter((c) => this.isCookieExpired(c));

      if (expiredCookies.length > 0) {
        this.logger.warn(
          `${expiredCookies.length} cookie(s) expired, re-authentication required`,
          'AuthService',
        );
        throw new AuthException(
          'Session expired. Please re-authenticate with: lumentui auth',
        );
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
      throw new AuthException('No cookies found. Please run: lumentui auth');
    }
  }

  /**
   * Check if a cookie is expired
   * @param cookie Cookie object
   * @returns true if cookie is expired, false otherwise
   */
  private isCookieExpired(cookie: Cookie): boolean {
    // If expires is 0 or not set, cookie doesn't expire
    if (!cookie.expires || cookie.expires === 0) {
      return false;
    }

    // expires is in seconds since epoch, compare with current time
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return cookie.expires < nowInSeconds;
  }

  validateCookies(): boolean {
    try {
      const cookieHeader = this.loadCookies();
      return !!cookieHeader;
    } catch {
      return false;
    }
  }
}
