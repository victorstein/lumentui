import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AuthService } from '../../auth/auth.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { firstValueFrom } from 'rxjs';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';
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

  /**
   * Type guard to check if an error is an Axios error
   */
  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      error.isAxiosError === true
    );
  }

  /**
   * Type guard to check if an error has a code property
   */
  private hasErrorCode(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    );
  }

  /**
   * Type guard to check if an error has a message property
   */
  private hasErrorMessage(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    );
  }

  /**
   * Type guard to check if an error has a stack property
   */
  private hasErrorStack(error: unknown): error is { stack: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'stack' in error &&
      typeof (error as { stack: unknown }).stack === 'string'
    );
  }

  private handleError(error: unknown): never {
    const errorStack = this.hasErrorStack(error) ? error.stack : undefined;
    this.logger.error('Failed to fetch products', errorStack, 'ShopifyService');

    // Handle specific HTTP errors
    if (this.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const responseMessage =
        (error.response.data as { message?: string } | undefined)?.message ||
        error.message;

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
          error as Error,
        );
      }

      throw new ShopifyException(
        `HTTP ${status}: ${responseMessage}`,
        status,
        error as Error,
      );
    }

    // Handle network errors
    if (this.hasErrorCode(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new ShopifyException(
          'Request timeout. Please check your internet connection.',
          undefined,
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new ShopifyException(
          'Cannot reach Shopify. Please check your internet connection.',
          undefined,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    // Generic error
    const errorMessage = this.hasErrorMessage(error)
      ? error.message
      : 'Unknown error';
    throw new ShopifyException(
      `Unexpected error: ${errorMessage}`,
      undefined,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
