/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CookieStorageService } from './cookie-storage.service';
import { LoggerService } from '../../common/logger/logger.service';
import { AuthException } from './exceptions/auth.exception';
import * as chromeCookies from './chrome-cookies';

// Mock chrome-cookies
jest.mock('./chrome-cookies');

describe('AuthService', () => {
  let service: AuthService;
  let cookieStorageService: CookieStorageService;
  let loggerService: LoggerService;
  let _configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CookieStorageService,
          useValue: {
            saveCookies: jest.fn(),
            loadCookies: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    cookieStorageService =
      module.get<CookieStorageService>(CookieStorageService);
    _configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCookies', () => {
    it('should extract storefront_digest cookie successfully', async () => {
      const mockCookies = [
        {
          name: '_shopify_essential',
          value: 'test-cookie-value',
          domain: 'shop.lumenalta.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: true,
          secure: true,
        },
      ];

      (chromeCookies.getCookiesForUrl as jest.Mock).mockReturnValue(
        mockCookies,
      );

      const result = await service.extractCookies('https://shop.lumenalta.com');

      expect(result).toEqual([mockCookies[0]]);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Extracting cookies'),
        'AuthService',
      );
    });

    it('should throw AuthException when storefront_digest not found', async () => {
      const mockCookies = [
        {
          name: 'other-cookie',
          value: 'value',
          domain: 'shop.lumenalta.com',
          path: '/',
          expires: 0,
          httpOnly: false,
          secure: false,
        },
      ];

      (chromeCookies.getCookiesForUrl as jest.Mock).mockReturnValue(
        mockCookies,
      );

      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow(AuthException);
      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow('Authentication cookie not found');
    });

    it('should handle chrome-cookies errors with AuthException', async () => {
      (chromeCookies.getCookiesForUrl as jest.Mock).mockImplementation(() => {
        throw new Error('Keychain access denied');
      });

      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow(AuthException);
      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow('Failed to access Chrome Keychain');
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('saveCookies', () => {
    it('should save cookies to storage', () => {
      const mockCookies = [
        {
          name: 'cookie1',
          value: 'value1',
          domain: 'test.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
        },
        {
          name: 'cookie2',
          value: 'value2',
          domain: 'test.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
        },
      ];

      service.saveCookies(mockCookies as any);

      expect(cookieStorageService.saveCookies).toHaveBeenCalledWith(
        mockCookies,
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Cookies saved successfully',
        'AuthService',
      );
    });

    it('should handle save errors', () => {
      const mockCookies = [{ name: 'cookie1', value: 'value1' }];

      (cookieStorageService.saveCookies as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => service.saveCookies(mockCookies as any)).toThrow(
        AuthException,
      );
    });
  });

  describe('loadCookies', () => {
    it('should load cookies from storage', () => {
      const mockCookies = [
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600, // Not expired (1 hour in future)
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        mockCookies,
      );

      const result = service.loadCookies();

      expect(result).toBe('test-cookie=test-value');
      expect(loggerService.log).toHaveBeenCalledWith(
        'Cookies loaded and validated successfully',
        'AuthService',
      );
    });

    it('should throw error when no cookies found', () => {
      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(null);

      expect(() => service.loadCookies()).toThrow(AuthException);
      expect(() => service.loadCookies()).toThrow('No cookies found');
    });

    it('should handle cookies with no expiration (expires = 0)', () => {
      const nonExpiringCookie = [
        {
          name: 'session-cookie',
          value: 'value',
          domain: 'test.com',
          path: '/',
          expires: 0, // Session cookie, no expiration
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        nonExpiringCookie,
      );

      const result = service.loadCookies();
      expect(result).toBe('session-cookie=value');
    });
  });

  describe('validateCookies', () => {
    it('should return true when cookies exist', () => {
      const mockCookies = [
        {
          name: 'test',
          value: 'value',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        mockCookies,
      );

      const result = service.validateCookies();

      expect(result).toBe(true);
    });

    it('should return false when no cookies exist', () => {
      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(null);

      const result = service.validateCookies();

      expect(result).toBe(false);
    });

    it('should return true even with old cookies (no expiration check)', () => {
      const oldCookie = [
        {
          name: 'test',
          value: 'value',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) - 3600,
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        oldCookie,
      );

      const result = service.validateCookies();

      expect(result).toBe(true);
    });
  });
});
