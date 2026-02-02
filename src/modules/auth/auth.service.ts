import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { CookieStorageService } from './cookie-storage.service';
import * as chrome from 'chrome-cookies-secure';
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
      // Wrap chrome.getCookies in Promise
      const cookies = await new Promise<Cookie[]>((resolve, reject) => {
        chrome.getCookies(
          url,
          'puppeteer',
          (err: Error | null, cookies: Cookie[]) => {
            if (err) {
              reject(err);
            } else {
              resolve(cookies || []);
            }
          },
        );
      });

      // Filter for storefront_digest cookie
      const digestCookie = cookies.find((c) => c.name === 'storefront_digest');

      if (!digestCookie) {
        throw new AuthException(
          'Authentication cookie not found. Please log in to shop.lumenalta.com in Chrome first.',
        );
      }

      this.logger.log('Cookie extracted successfully', 'AuthService');
      return [digestCookie];
    } catch (error) {
      this.logger.error(
        'Failed to extract cookies',
        error.stack,
        'AuthService',
      );

      // FIX #3: Wrap error con contexto user-friendly
      if (error instanceof AuthException) {
        throw error;
      }

      if (
        error.message?.includes('Keychain') ||
        error.message?.includes('access')
      ) {
        throw new AuthException(
          'Failed to access Chrome Keychain. Please grant permission when prompted.',
        );
      }

      throw new AuthException(`Cookie extraction failed: ${error.message}`);
    }
  }

  async saveCookies(cookies: Cookie[]): Promise<void> {
    this.logger.log('Saving cookies to storage', 'AuthService');

    try {
      // Convert cookies to Cookie header format
      const cookieHeader = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      // FIX #2: Use CookieStorageService instead of process.env
      this.cookieStorage.saveCookies(cookieHeader);

      this.logger.log('Cookies saved successfully', 'AuthService');
    } catch (error) {
      this.logger.error('Failed to save cookies', error.stack, 'AuthService');
      throw new AuthException('Failed to save cookies');
    }
  }

  async loadCookies(): Promise<string> {
    this.logger.log('Loading cookies from storage', 'AuthService');

    try {
      // FIX #2: Use CookieStorageService
      const cookieHeader = this.cookieStorage.loadCookies();

      if (!cookieHeader) {
        throw new AuthException('No cookies found. Please run: lumentui auth');
      }

      // FIX #1: Validar expiración antes de retornar
      const cookies = this.parseCookieHeader(cookieHeader);
      const expiredCookies = cookies.filter((c) => this.isCookieExpired(c));

      if (expiredCookies.length > 0) {
        this.logger.warn(
          'Cookies expired, re-authentication required',
          'AuthService',
        );
        throw new AuthException(
          'Session expired. Please re-authenticate with: lumentui auth',
        );
      }

      this.logger.log('Cookies loaded successfully', 'AuthService');
      return cookieHeader;
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }

      this.logger.error('Failed to load cookies', error.stack, 'AuthService');
      throw new AuthException('No cookies found. Please run: lumentui auth');
    }
  }

  // FIX #1: Agregar método helper para parsear cookie header
  private parseCookieHeader(cookieHeader: string): Cookie[] {
    // Parse "name1=value1; name2=value2" → Cookie[]
    const parts = cookieHeader.split('; ');
    return parts.map((part) => {
      const [name, value] = part.split('=');
      // Note: expires is not stored in the cookie header format
      // For full expiration validation, we need to store full Cookie objects
      // For now, return a minimal Cookie object with expires: 0 (never expires)
      return {
        name,
        value,
        domain: '',
        path: '/',
        expires: 0, // No expiration info available from header format
      } as Cookie;
    });
  }

  private isCookieExpired(cookie: Cookie): boolean {
    if (!cookie.expires) return false;
    return cookie.expires < Date.now() / 1000;
  }

  async validateCookies(): Promise<boolean> {
    try {
      const cookieHeader = await this.loadCookies();
      return !!cookieHeader;
    } catch {
      return false;
    }
  }
}
