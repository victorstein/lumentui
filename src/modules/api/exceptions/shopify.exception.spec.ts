import {
  ShopifyException,
  ShopifyAuthException,
  ShopifyRateLimitException,
} from './shopify.exception';

describe('ShopifyException', () => {
  describe('ShopifyException base class', () => {
    it('should be instanceof ShopifyException', () => {
      const error = new ShopifyException('Test error');
      expect(error).toBeInstanceOf(ShopifyException);
    });

    it('should be instanceof Error', () => {
      const error = new ShopifyException('Test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new ShopifyException('Test error');
      expect(error.name).toBe('ShopifyException');
    });

    it('should preserve message', () => {
      const message = 'Custom error message';
      const error = new ShopifyException(message);
      expect(error.message).toBe(message);
    });

    it('should store statusCode when provided', () => {
      const error = new ShopifyException('Test error', 500);
      expect(error.statusCode).toBe(500);
    });

    it('should store originalError when provided', () => {
      const original = new Error('Original');
      const error = new ShopifyException('Test error', 500, original);
      expect(error.originalError).toBe(original);
    });
  });

  describe('ShopifyAuthException', () => {
    it('should be instanceof ShopifyAuthException', () => {
      const error = new ShopifyAuthException('Auth failed');
      expect(error).toBeInstanceOf(ShopifyAuthException);
    });

    it('should be instanceof ShopifyException', () => {
      const error = new ShopifyAuthException('Auth failed');
      expect(error).toBeInstanceOf(ShopifyException);
    });

    it('should be instanceof Error', () => {
      const error = new ShopifyAuthException('Auth failed');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new ShopifyAuthException('Auth failed');
      expect(error.name).toBe('ShopifyAuthException');
    });

    it('should have statusCode 401', () => {
      const error = new ShopifyAuthException('Auth failed');
      expect(error.statusCode).toBe(401);
    });

    it('should preserve message', () => {
      const message = 'Invalid credentials';
      const error = new ShopifyAuthException(message);
      expect(error.message).toBe(message);
    });
  });

  describe('ShopifyRateLimitException', () => {
    it('should be instanceof ShopifyRateLimitException', () => {
      const error = new ShopifyRateLimitException('Rate limit exceeded');
      expect(error).toBeInstanceOf(ShopifyRateLimitException);
    });

    it('should be instanceof ShopifyException', () => {
      const error = new ShopifyRateLimitException('Rate limit exceeded');
      expect(error).toBeInstanceOf(ShopifyException);
    });

    it('should be instanceof Error', () => {
      const error = new ShopifyRateLimitException('Rate limit exceeded');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new ShopifyRateLimitException('Rate limit exceeded');
      expect(error.name).toBe('ShopifyRateLimitException');
    });

    it('should have statusCode 429', () => {
      const error = new ShopifyRateLimitException('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
    });

    it('should preserve message', () => {
      const message = 'Too many requests';
      const error = new ShopifyRateLimitException(message);
      expect(error.message).toBe(message);
    });
  });

  describe('Prototype chain validation', () => {
    it('should maintain correct prototype chain for ShopifyException', () => {
      const error = new ShopifyException('Test');
      expect(Object.getPrototypeOf(error)).toBe(ShopifyException.prototype);
    });

    it('should maintain correct prototype chain for ShopifyAuthException', () => {
      const error = new ShopifyAuthException('Test');
      expect(Object.getPrototypeOf(error)).toBe(ShopifyAuthException.prototype);
    });

    it('should maintain correct prototype chain for ShopifyRateLimitException', () => {
      const error = new ShopifyRateLimitException('Test');
      expect(Object.getPrototypeOf(error)).toBe(
        ShopifyRateLimitException.prototype,
      );
    });
  });

  describe('Error catching behavior', () => {
    it('should catch ShopifyAuthException as ShopifyException', () => {
      try {
        throw new ShopifyAuthException('Auth failed');
      } catch (error) {
        expect(error).toBeInstanceOf(ShopifyException);
        expect(error).toBeInstanceOf(ShopifyAuthException);
      }
    });

    it('should catch ShopifyRateLimitException as ShopifyException', () => {
      try {
        throw new ShopifyRateLimitException('Rate limit');
      } catch (error) {
        expect(error).toBeInstanceOf(ShopifyException);
        expect(error).toBeInstanceOf(ShopifyRateLimitException);
      }
    });

    it('should distinguish between different exception types', () => {
      const authError = new ShopifyAuthException('Auth');
      const rateLimitError = new ShopifyRateLimitException('Rate');

      expect(authError).toBeInstanceOf(ShopifyAuthException);
      expect(authError).not.toBeInstanceOf(ShopifyRateLimitException);

      expect(rateLimitError).toBeInstanceOf(ShopifyRateLimitException);
      expect(rateLimitError).not.toBeInstanceOf(ShopifyAuthException);
    });
  });
});
