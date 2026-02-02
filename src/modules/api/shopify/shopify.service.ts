import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AuthService } from '../../auth/auth.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { firstValueFrom } from 'rxjs';
import axiosRetry from 'axios-retry';
import {
  ShopifyException,
  ShopifyAuthException,
  ShopifyRateLimitException,
} from '../exceptions/shopify.exception';
import {
  ShopifyProduct,
  ShopifyProductsResponse,
} from '../interfaces/shopify.interface';

@Injectable()
export class ShopifyService implements OnModuleInit {
  private readonly SHOPIFY_URL = 'https://shop.lumenalta.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    // Configure axios-retry
    axiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on network errors or 5xx
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (status !== undefined && status >= 500 && status < 600)
        );
      },
      onRetry: (retryCount, error) => {
        this.logger.log(
          `Retry attempt ${retryCount} for ${error.config?.url}`,
          'ShopifyService',
        );
      },
    });
  }

  async getProducts(): Promise<ShopifyProduct[]> {
    this.logger.log('Fetching products from Shopify', 'ShopifyService');

    try {
      const cookieHeader = await this.authService.loadCookies();

      const response = await firstValueFrom(
        this.httpService.get<ShopifyProductsResponse>(
          `${this.SHOPIFY_URL}/products.json`,
          {
            headers: {
              Cookie: cookieHeader,
              'User-Agent': 'LumenTUI/1.0',
            },
            timeout: 10000, // 10 second timeout
          },
        ),
      );

      const products = response.data.products || [];

      this.logger.log(
        `Fetched ${products.length} products successfully`,
        'ShopifyService',
      );

      return products;
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: any): never {
    this.logger.error(
      'Failed to fetch products',
      error.stack,
      'ShopifyService',
    );

    // Handle specific HTTP errors
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 401 || status === 403) {
        throw new ShopifyAuthException(
          'Authentication failed. Please re-run: lumentui auth',
        );
      }

      if (status === 429) {
        throw new ShopifyRateLimitException(
          'Rate limit exceeded. Please wait before retrying.',
        );
      }

      if (status >= 500) {
        throw new ShopifyException(
          `Shopify server error (${status}). Please try again later.`,
          status,
          error,
        );
      }

      throw new ShopifyException(`HTTP ${status}: ${message}`, status, error);
    }

    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      throw new ShopifyException(
        'Request timeout. Please check your internet connection.',
        undefined,
        error,
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new ShopifyException(
        'Cannot reach Shopify. Please check your internet connection.',
        undefined,
        error,
      );
    }

    // Generic error
    throw new ShopifyException(
      `Unexpected error: ${error.message}`,
      undefined,
      error,
    );
  }
}
