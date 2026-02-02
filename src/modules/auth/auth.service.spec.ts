import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CookieStorageService } from './cookie-storage.service';
import { LoggerService } from '../../common/logger/logger.service';
import { AuthException } from './exceptions/auth.exception';
import * as chrome from 'chrome-cookies-secure';

// Mock chrome-cookies-secure
jest.mock('chrome-cookies-secure');

describe('AuthService', () => {
  let service: AuthService;
  let cookieStorageService: CookieStorageService;
  let configService: ConfigService;
  let loggerService: LoggerService;

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
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCookies', () => {
    it('should extract storefront_digest cookie successfully', async () => {
      const mockCookies = [
        {
          name: 'storefront_digest',
          value: 'test-cookie-value',
          domain: 'shop.lumenalta.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: true,
          secure: true,
        },
      ];

      (chrome.getCookies as jest.Mock).mockImplementation(
        (url, format, callback) => {
          callback(null, mockCookies);
        },
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
        },
      ];

      (chrome.getCookies as jest.Mock).mockImplementation(
        (url, format, callback) => {
          callback(null, mockCookies);
        },
      );

      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow(AuthException);
      await expect(
        service.extractCookies('https://shop.lumenalta.com'),
      ).rejects.toThrow('Authentication cookie not found');
    });

    it('should handle chrome-cookies-secure errors with AuthException', async () => {
      (chrome.getCookies as jest.Mock).mockImplementation(
        (url, format, callback) => {
          callback(new Error('Keychain access denied'), null);
        },
      );

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
    it('should save cookies to storage', async () => {
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

      await service.saveCookies(mockCookies as any);

      expect(cookieStorageService.saveCookies).toHaveBeenCalledWith(
        mockCookies,
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Cookies saved successfully',
        'AuthService',
      );
    });

    it('should handle save errors', async () => {
      const mockCookies = [{ name: 'cookie1', value: 'value1' }];

      (cookieStorageService.saveCookies as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      await expect(service.saveCookies(mockCookies as any)).rejects.toThrow(
        AuthException,
      );
    });
  });

  describe('loadCookies', () => {
    it('should load cookies from storage', async () => {
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

      const result = await service.loadCookies();

      expect(result).toBe('test-cookie=test-value');
      expect(loggerService.log).toHaveBeenCalledWith(
        'Cookies loaded and validated successfully',
        'AuthService',
      );
    });

    it('should throw error when no cookies found', async () => {
      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(null);

      await expect(service.loadCookies()).rejects.toThrow(AuthException);
      await expect(service.loadCookies()).rejects.toThrow('No cookies found');
    });

    it('should throw error when cookies are expired', async () => {
      const expiredCookie = [
        {
          name: 'storefront_digest',
          value: 'expired-value',
          domain: 'shop.lumenalta.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        expiredCookie,
      );

      await expect(service.loadCookies()).rejects.toThrow(AuthException);
      await expect(service.loadCookies()).rejects.toThrow('Session expired');
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('expired'),
        'AuthService',
      );
    });

    it('should handle multiple cookies with some expired', async () => {
      const mockCookies = [
        {
          name: 'valid-cookie',
          value: 'value1',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600, // Valid
        },
        {
          name: 'expired-cookie',
          value: 'value2',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) - 3600, // Expired
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        mockCookies,
      );

      await expect(service.loadCookies()).rejects.toThrow(AuthException);
      await expect(service.loadCookies()).rejects.toThrow('Session expired');
    });

    it('should handle cookies with no expiration (expires = 0)', async () => {
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

      const result = await service.loadCookies();
      expect(result).toBe('session-cookie=value');
    });
  });

  describe('validateCookies', () => {
    it('should return true when cookies exist', async () => {
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

      const result = await service.validateCookies();

      expect(result).toBe(true);
    });

    it('should return false when no cookies exist', async () => {
      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(null);

      const result = await service.validateCookies();

      expect(result).toBe(false);
    });

    it('should return false when cookies are expired', async () => {
      const expiredCookie = [
        {
          name: 'test',
          value: 'value',
          domain: 'test.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) - 3600,
        },
      ];

      (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
        expiredCookie,
      );

      const result = await service.validateCookies();

      expect(result).toBe(false);
    });
  });
});
