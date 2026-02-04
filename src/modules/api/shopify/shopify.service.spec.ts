import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { ShopifyService } from './shopify.service';
import { AuthService } from '../../auth/auth.service';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  ShopifyAuthException,
  ShopifyRateLimitException,
  ShopifyException,
} from '../exceptions/shopify.exception';

describe('ShopifyService', () => {
  let service: ShopifyService;
  let httpService: HttpService;
  let authService: AuthService;
  let loggerService: LoggerService;

  const mockProducts = {
    products: [
      {
        id: 123,
        title: 'Test Product',
        handle: 'test-product',
        body_html: '<p>Description</p>',
        vendor: 'Lumenalta',
        product_type: 'Merchandise',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        tags: 'test',
        variants: [
          {
            id: 456,
            product_id: 123,
            title: 'Default',
            price: '29.99',
            sku: 'TEST-001',
            position: 1,
            inventory_policy: 'deny',
            compare_at_price: null,
            fulfillment_service: 'manual',
            inventory_management: 'shopify',
            option1: null,
            option2: null,
            option3: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            taxable: true,
            barcode: null,
            grams: 100,
            image_id: null,
            weight: 0.1,
            weight_unit: 'kg',
            inventory_item_id: 789,
            inventory_quantity: 10,
            old_inventory_quantity: 10,
            requires_shipping: true,
          },
        ],
        images: [
          {
            id: 101,
            product_id: 123,
            position: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            alt: 'Product image',
            width: 1000,
            height: 1000,
            src: 'https://example.com/image.jpg',
            variant_ids: [],
          },
        ],
        options: [],
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            axiosRef: {}, // Mock for axios-retry
          },
        },
        {
          provide: AuthService,
          useValue: {
            loadCookies: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    httpService = module.get<HttpService>(HttpService);
    authService = module.get<AuthService>(AuthService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should fetch products successfully', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockResponse: AxiosResponse = {
        data: mockProducts,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getProducts();

      expect(result).toEqual(mockProducts.products);
      expect(authService.loadCookies).toHaveBeenCalled();
      expect(httpService.get).toHaveBeenCalledWith(
        'https://shop.lumenalta.com/products.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: mockCookieHeader,
            'User-Agent': 'LumenTUI/1.0',
          }),
        }),
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Fetched 1 products successfully',
        'ShopifyService',
      );
    });

    it('should throw ShopifyAuthException on 401 error', async () => {
      const mockCookieHeader = 'storefront_digest=expired-cookie';
      const mockError: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        } as any,
        isAxiosError: true,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(ShopifyAuthException);
      await expect(service.getProducts()).rejects.toThrow(
        'Authentication failed. Please re-run: lumentui login',
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should throw ShopifyAuthException on 403 error', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockError: Partial<AxiosError> = {
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        } as any,
        isAxiosError: true,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(ShopifyAuthException);
    });

    it('should throw ShopifyRateLimitException on 429 error', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockError: Partial<AxiosError> = {
        response: {
          status: 429,
          data: { message: 'Too Many Requests' },
        } as any,
        isAxiosError: true,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(
        ShopifyRateLimitException,
      );
      await expect(service.getProducts()).rejects.toThrow(
        'Rate limit exceeded. Please wait before retrying.',
      );
    });

    it('should throw ShopifyException on 5xx error', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockError: Partial<AxiosError> = {
        response: {
          status: 503,
          data: { message: 'Service Unavailable' },
        } as any,
        isAxiosError: true,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(ShopifyException);
      await expect(service.getProducts()).rejects.toThrow(
        'Shopify server error (503). Please try again later.',
      );
    });

    it('should throw ShopifyException on timeout', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockError: Partial<AxiosError> = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
        isAxiosError: true,
      } as any;

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(ShopifyException);
      await expect(service.getProducts()).rejects.toThrow(
        'Request timeout. Please check your internet connection.',
      );
    });

    it('should throw ShopifyException on network error', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockError: Partial<AxiosError> = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND shop.lumenalta.com',
        isAxiosError: true,
      } as any;

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      await expect(service.getProducts()).rejects.toThrow(ShopifyException);
      await expect(service.getProducts()).rejects.toThrow(
        'Cannot reach Shopify. Please check your internet connection.',
      );
    });

    it('should return empty array when products is undefined', async () => {
      const mockCookieHeader = 'storefront_digest=test-cookie';
      const mockResponse: AxiosResponse = {
        data: { products: undefined },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(authService, 'loadCookies').mockReturnValue(mockCookieHeader);
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getProducts();

      expect(result).toEqual([]);
    });
  });
});
