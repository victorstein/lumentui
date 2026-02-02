export class ShopifyException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ShopifyException';
    Object.setPrototypeOf(this, ShopifyException.prototype);
  }
}

export class ShopifyAuthException extends ShopifyException {
  constructor(message: string) {
    super(message, 401);
    this.name = 'ShopifyAuthException';
    Object.setPrototypeOf(this, ShopifyAuthException.prototype);
  }
}

export class ShopifyRateLimitException extends ShopifyException {
  constructor(message: string) {
    super(message, 429);
    this.name = 'ShopifyRateLimitException';
    Object.setPrototypeOf(this, ShopifyRateLimitException.prototype);
  }
}
