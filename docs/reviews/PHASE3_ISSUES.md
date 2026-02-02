# 🐛 Issues Detallados - Fase 3

**Fecha:** 2025-01-21  
**Total Issues:** 6 (1 crítico, 2 medios, 3 menores)

---

## 🔴 Críticos (Bloquean merge a main)

### C1: Custom Exceptions sin Prototype Fix

**Severidad:** 🔴 CRÍTICO  
**Archivo:** `src/modules/api/exceptions/shopify.exception.ts`  
**Líneas:** 1-25  
**Impacto:** Break `instanceof` checks en producción

#### Descripción
Las custom exceptions no llaman a `Object.setPrototypeOf()`, lo que rompe la cadena de prototipos cuando TypeScript transpila a ES5. Esto causa que `instanceof` falle:

```typescript
try {
  throw new ShopifyAuthException('Auth failed');
} catch (error) {
  if (error instanceof ShopifyAuthException) {
    // ❌ NUNCA entra aquí en ES5
  }
}
```

#### Código Actual
```typescript
export class ShopifyException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ShopifyException';
    // ❌ FALTA prototype fix
  }
}

export class ShopifyAuthException extends ShopifyException {
  constructor(message: string) {
    super(message, 401);
    this.name = 'ShopifyAuthException';
    // ❌ FALTA prototype fix
  }
}

export class ShopifyRateLimitException extends ShopifyException {
  constructor(message: string) {
    super(message, 429);
    this.name = 'ShopifyRateLimitException';
    // ❌ FALTA prototype fix
  }
}
```

#### Solución
```typescript
export class ShopifyException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ShopifyException';
    Object.setPrototypeOf(this, ShopifyException.prototype); // ✅ FIX
  }
}

export class ShopifyAuthException extends ShopifyException {
  constructor(message: string) {
    super(message, 401);
    this.name = 'ShopifyAuthException';
    Object.setPrototypeOf(this, ShopifyAuthException.prototype); // ✅ FIX
  }
}

export class ShopifyRateLimitException extends ShopifyException {
  constructor(message: string) {
    super(message, 429);
    this.name = 'ShopifyRateLimitException';
    Object.setPrototypeOf(this, ShopifyRateLimitException.prototype); // ✅ FIX
  }
}
```

#### Test para Validar
```typescript
// src/modules/api/exceptions/shopify.exception.spec.ts
describe('ShopifyException', () => {
  it('should preserve prototype chain', () => {
    const error = new ShopifyAuthException('Test');
    
    expect(error instanceof ShopifyAuthException).toBe(true);
    expect(error instanceof ShopifyException).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
```

#### Referencias
- [TypeScript Breaking Changes - Extending Built-ins](https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work)
- [MDN - Object.setPrototypeOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)

#### Esfuerzo Estimado
⏱️ **5 minutos** (agregar 3 líneas + test)

#### Prioridad
🚨 **DEBE CORREGIRSE ANTES DE MERGE**

---

## 🟡 Medios (Afectan calidad/mantenibilidad)

### M1: ProductNormalizer - Edge Case Variantes Vacías

**Severidad:** 🟡 MEDIO  
**Archivo:** `src/modules/api/utils/normalizer.util.ts`  
**Líneas:** 9-11  
**Impacto:** `price: Infinity` para productos sin variantes

#### Descripción
Si `product.variants` está vacío, `Math.min()` retorna `Infinity`:

```typescript
const minPrice = Math.min(
  ...product.variants.map(v => parseFloat(v.price))
);
// Si variants.length === 0:
// Math.min() retorna Infinity
```

#### Ejemplo de Fallo
```typescript
const product = {
  id: 123,
  title: 'Test Product',
  variants: [], // ❌ vacío
  // ...
};

const normalized = ProductNormalizer.normalize(product, 'https://shop.com');
console.log(normalized.price); // Infinity ❌
```

#### Solución Opción 1: Validación Estricta
```typescript
static normalize(product: ShopifyProduct, baseUrl: string): ProductDto {
  // Validar que tenga variantes
  if (!product.variants || product.variants.length === 0) {
    throw new Error(
      `Product ${product.id} ("${product.title}") has no variants`
    );
  }

  const minPrice = Math.min(
    ...product.variants.map(v => parseFloat(v.price))
  );
  
  // ... resto del código
}
```

#### Solución Opción 2: Valor por Defecto
```typescript
static normalize(product: ShopifyProduct, baseUrl: string): ProductDto {
  const minPrice = product.variants.length > 0
    ? Math.min(...product.variants.map(v => parseFloat(v.price)))
    : 0; // o null, según lógica de negocio

  const available = product.variants.length > 0 &&
    product.variants.some(v => v.inventory_quantity > 0);

  // ... resto del código
}
```

#### Tests Sugeridos
```typescript
// src/modules/api/utils/normalizer.util.spec.ts
describe('ProductNormalizer', () => {
  it('should throw error for product without variants', () => {
    const product = { id: 1, variants: [], /* ... */ };
    
    expect(() => 
      ProductNormalizer.normalize(product, 'https://shop.com')
    ).toThrow('has no variants');
  });

  it('should handle product with single variant', () => {
    const product = {
      id: 1,
      variants: [{ price: '29.99', inventory_quantity: 10 }],
      // ...
    };
    
    const result = ProductNormalizer.normalize(product, 'https://shop.com');
    expect(result.price).toBe(29.99);
    expect(result.available).toBe(true);
  });

  it('should find minimum price from multiple variants', () => {
    const product = {
      id: 1,
      variants: [
        { price: '29.99', inventory_quantity: 10 },
        { price: '19.99', inventory_quantity: 5 },
        { price: '39.99', inventory_quantity: 0 },
      ],
      // ...
    };
    
    const result = ProductNormalizer.normalize(product, 'https://shop.com');
    expect(result.price).toBe(19.99);
  });

  it('should mark unavailable if all variants out of stock', () => {
    const product = {
      id: 1,
      variants: [
        { price: '29.99', inventory_quantity: 0 },
        { price: '19.99', inventory_quantity: 0 },
      ],
      // ...
    };
    
    const result = ProductNormalizer.normalize(product, 'https://shop.com');
    expect(result.available).toBe(false);
  });

  it('should strip HTML from description', () => {
    const product = {
      id: 1,
      body_html: '<p>Test <strong>description</strong></p>',
      variants: [{ price: '29.99', inventory_quantity: 10 }],
      // ...
    };
    
    const result = ProductNormalizer.normalize(product, 'https://shop.com');
    expect(result.description).toBe('Test description');
  });

  it('should generate correct product URL', () => {
    const product = {
      id: 1,
      handle: 'test-product',
      variants: [{ price: '29.99', inventory_quantity: 10 }],
      // ...
    };
    
    const result = ProductNormalizer.normalize(
      product,
      'https://shop.lumenalta.com'
    );
    expect(result.url).toBe('https://shop.lumenalta.com/products/test-product');
  });
});
```

#### Esfuerzo Estimado
⏱️ **30 minutos** (validación + tests)

#### Prioridad
⚠️ **RECOMENDADO** antes de Fase 4

---

### M2: Type Safety - handleError usa `any`

**Severidad:** 🟡 MEDIO  
**Archivo:** `src/modules/api/shopify/shopify.service.ts`  
**Líneas:** 73-128  
**Impacto:** Pérdida de type safety, potenciales runtime errors

#### Descripción
El método `handleError()` usa `any` como tipo de parámetro, eliminando type checking:

```typescript
private handleError(error: any): never {
  // ❌ TypeScript no verifica que error tenga las propiedades usadas
  if (error.response) { // ¿existe response?
    const status = error.response.status; // ¿existe status?
  }
  if (error.code === 'ECONNABORTED') { // ¿existe code?
  }
}
```

#### Código Actual
```typescript
private handleError(error: any): never {
  this.logger.error(
    'Failed to fetch products',
    error.stack, // ❌ ¿existe stack?
    'ShopifyService'
  );

  if (error.response) { // ❌ sin type checking
    // ...
  }
}
```

#### Solución con Type Guards
```typescript
import { AxiosError } from 'axios';

private handleError(error: unknown): never {
  // Logging seguro
  this.logger.error(
    'Failed to fetch products',
    error instanceof Error ? error.stack : String(error),
    'ShopifyService'
  );

  // Type guard para AxiosError
  if (this.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status; // ✅ type-safe
      const message = error.response.data?.message || error.message;

      if (status === 401 || status === 403) {
        throw new ShopifyAuthException(
          'Authentication failed. Please re-run: lumentui auth'
        );
      }

      if (status === 429) {
        throw new ShopifyRateLimitException(
          'Rate limit exceeded. Please wait before retrying.'
        );
      }

      if (status >= 500) {
        throw new ShopifyException(
          `Shopify server error (${status}). Please try again later.`,
          status,
          error
        );
      }

      throw new ShopifyException(
        `HTTP ${status}: ${message}`,
        status,
        error
      );
    }

    // Network errors
    if (error.code === 'ECONNABORTED') {
      throw new ShopifyException(
        'Request timeout. Please check your internet connection.',
        undefined,
        error
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new ShopifyException(
        'Cannot reach Shopify. Please check your internet connection.',
        undefined,
        error
      );
    }
  }

  // Fallback genérico
  throw new ShopifyException(
    `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    undefined,
    error instanceof Error ? error : undefined
  );
}

/**
 * Type guard para verificar si error es AxiosError
 */
private isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}
```

#### Beneficios
- ✅ TypeScript verifica acceso a propiedades
- ✅ Autocompletado en IDE
- ✅ Detección de errores en compile-time
- ✅ Más fácil de refactorizar

#### Esfuerzo Estimado
⏱️ **20 minutos** (refactor + type guard)

#### Prioridad
⚠️ **OPCIONAL** - puede hacerse en PR separado

---

## 🟢 Menores (Mejoras sugeridas)

### N1: URL Hardcodeada - Mover a ConfigService

**Severidad:** 🟢 MENOR  
**Archivo:** `src/modules/api/shopify/shopify.service.ts`  
**Línea:** 17  
**Impacto:** Configuración menos flexible

#### Descripción
La URL de Shopify está hardcodeada en el servicio:

```typescript
private readonly SHOPIFY_URL = 'https://shop.lumenalta.com';
```

#### Solución
```typescript
// src/modules/api/shopify/shopify.service.ts
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShopifyService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService, // ✅ AGREGAR
  ) {}

  async getProducts(): Promise<ShopifyProduct[]> {
    const shopifyUrl = this.configService.get<string>(
      'SHOPIFY_URL',
      'https://shop.lumenalta.com' // default
    );

    const response = await firstValueFrom(
      this.httpService.get<ShopifyProductsResponse>(
        `${shopifyUrl}/products.json`,
        // ...
      )
    );
  }
}
```

#### Config File
```typescript
// .env
SHOPIFY_URL=https://shop.lumenalta.com

// .env.development
SHOPIFY_URL=https://shop-dev.lumenalta.com

// .env.test
SHOPIFY_URL=http://localhost:3001/mock-shopify
```

#### Beneficios
- ✅ Cambio entre ambientes sin rebuild
- ✅ Fácil testing con mock server
- ✅ Configuración centralizada

#### Esfuerzo Estimado
⏱️ **15 minutos**

#### Prioridad
🔵 **NICE TO HAVE**

---

### N2: Logging - Agregar Request ID para Traceability

**Severidad:** 🟢 MENOR  
**Archivo:** `src/modules/api/shopify/shopify.service.ts`  
**Impacto:** Debugging menos eficiente en producción

#### Descripción
Los logs actuales no tienen request ID para correlacionar requests:

```typescript
this.logger.log('Fetching products from Shopify', 'ShopifyService');
// [ShopifyService] Fetching products from Shopify
// [ShopifyService] Fetching products from Shopify
// ❌ ¿Cuál es cuál?
```

#### Solución
```typescript
async getProducts(requestId?: string): Promise<ShopifyProduct[]> {
  const context = requestId 
    ? `ShopifyService:${requestId}` 
    : 'ShopifyService';
  
  this.logger.log('Fetching products from Shopify', context);
  // [ShopifyService:abc123] Fetching products from Shopify
  // [ShopifyService:def456] Fetching products from Shopify
  // ✅ Fácil de correlacionar

  try {
    // ...
    this.logger.log(
      `Fetched ${products.length} products successfully`,
      context
    );
    return products;
  } catch (error) {
    this.logger.error(
      'Failed to fetch products',
      error.stack,
      context // ✅ Mismo request ID
    );
    return this.handleError(error);
  }
}
```

#### Uso con UUID
```typescript
import { v4 as uuidv4 } from 'uuid';

// En el controller o caller
const requestId = uuidv4();
const products = await shopifyService.getProducts(requestId);
```

#### Beneficios
- ✅ Correlación de logs en producción
- ✅ Debugging más rápido
- ✅ Métricas por request

#### Esfuerzo Estimado
⏱️ **10 minutos**

#### Prioridad
🔵 **NICE TO HAVE**

---

### N3: Tests - Agregar Test de Integración con Timeout Real

**Severidad:** 🟢 MENOR  
**Archivo:** `src/modules/api/shopify/shopify.service.spec.ts`  
**Impacto:** Coverage incompleto de timeout behavior

#### Descripción
El test actual de timeout solo verifica el error code, no el timeout real:

```typescript
it('should throw ShopifyException on timeout', async () => {
  const mockError: Partial<AxiosError> = {
    code: 'ECONNABORTED', // ❌ mock, no timeout real
  };
  
  jest.spyOn(httpService, 'get').mockReturnValue(
    throwError(() => mockError)
  );
  
  await expect(service.getProducts()).rejects.toThrow('timeout');
});
```

#### Test Mejorado
```typescript
it('should timeout after 10 seconds (integration)', async () => {
  jest.useFakeTimers();
  
  jest.spyOn(authService, 'loadCookies').mockResolvedValue('cookie');
  
  // Mock que nunca completa
  jest.spyOn(httpService, 'get').mockReturnValue(
    new Observable(subscriber => {
      // Simula request que nunca completa
      setTimeout(() => {
        subscriber.error({
          code: 'ECONNABORTED',
          message: 'timeout of 10000ms exceeded',
          isAxiosError: true,
        });
      }, 10000);
    })
  );

  const promise = service.getProducts();
  
  // Avanzar reloj virtual
  jest.advanceTimersByTime(10000);

  await expect(promise).rejects.toThrow(ShopifyException);
  await expect(promise).rejects.toThrow('timeout');
  
  jest.useRealTimers();
}, 15000); // ✅ timeout del test mayor que timeout del servicio
```

#### Beneficios
- ✅ Verifica timeout real, no solo error code
- ✅ Valida configuración de 10s
- ✅ Detecta regresiones en timeout config

#### Esfuerzo Estimado
⏱️ **15 minutos**

#### Prioridad
🔵 **NICE TO HAVE**

---

## 📊 Resumen de Prioridades

| ID | Título | Severidad | Esfuerzo | Prioridad |
|----|--------|-----------|----------|-----------|
| C1 | Custom Exceptions sin Prototype Fix | 🔴 CRÍTICO | 5 min | 🚨 **DEBE HACERSE ANTES DE MERGE** |
| M1 | ProductNormalizer - Edge Case Variantes Vacías | 🟡 MEDIO | 30 min | ⚠️ **RECOMENDADO** antes de Fase 4 |
| M2 | Type Safety - handleError usa `any` | 🟡 MEDIO | 20 min | ⚠️ **OPCIONAL** - PR separado |
| N1 | URL Hardcodeada - Mover a ConfigService | 🟢 MENOR | 15 min | 🔵 **NICE TO HAVE** |
| N2 | Logging - Agregar Request ID | 🟢 MENOR | 10 min | 🔵 **NICE TO HAVE** |
| N3 | Tests - Timeout Real | 🟢 MENOR | 15 min | 🔵 **NICE TO HAVE** |

**Total Esfuerzo:**
- 🚨 Críticos: 5 min
- ⚠️ Recomendados: 50 min (30 + 20)
- 🔵 Nice to Have: 40 min (15 + 10 + 15)

---

**Actualizado:** 2025-01-21  
**Próxima Revisión:** Después de correcciones
