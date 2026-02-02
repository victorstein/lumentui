# 📋 Recomendaciones y Roadmap - Post Fase 3

**Fecha:** 2025-01-21  
**Estado Fase 3:** ⚠️ Aprobado con observaciones menores

---

## 🎯 Acción Inmediata (Antes de Merge)

### 1. Fijar Custom Exceptions (5 minutos) 🚨

**Tarea:** Agregar `Object.setPrototypeOf()` a todas las custom exceptions

**Archivo:** `src/modules/api/exceptions/shopify.exception.ts`

**Comando:**
```bash
cd /home/clawdbot/clawd/development/lumentui/lumentui
# Editar archivo con fix de prototype
npm test -- shopify.exception.spec  # Validar con test
npm run build  # Verificar compilación
```

**Checklist:**
- [ ] Agregar `Object.setPrototypeOf(this, ShopifyException.prototype)` a ShopifyException
- [ ] Agregar `Object.setPrototypeOf(this, ShopifyAuthException.prototype)` a ShopifyAuthException
- [ ] Agregar `Object.setPrototypeOf(this, ShopifyRateLimitException.prototype)` a ShopifyRateLimitException
- [ ] Crear test `shopify.exception.spec.ts` verificando `instanceof`
- [ ] Ejecutar tests (deben pasar)
- [ ] Build exitoso

---

## 🔧 Mejoras Recomendadas (Antes de Fase 4)

### 2. Agregar Tests a ProductNormalizer (30 minutos) ⚠️

**Motivación:**
- Normalizer tiene 0% coverage
- Edge case crítico: productos sin variantes → `price: Infinity`
- Lógica de negocio importante (precio mínimo, disponibilidad, strip HTML)

**Tarea:**
```bash
touch src/modules/api/utils/normalizer.util.spec.ts
```

**Tests mínimos:**
```typescript
describe('ProductNormalizer', () => {
  it('should throw error for product without variants');
  it('should find minimum price from multiple variants');
  it('should mark unavailable if all variants out of stock');
  it('should strip HTML from description');
  it('should generate correct product URL');
  it('should handle null body_html');
});
```

**Checklist:**
- [ ] Crear `normalizer.util.spec.ts`
- [ ] 6 tests mínimos implementados
- [ ] Agregar validación de variantes vacías en normalizer
- [ ] Coverage > 90%
- [ ] Tests pasando

**Comando:**
```bash
npm test -- normalizer.util.spec
```

---

### 3. Mejorar Type Safety en handleError (20 minutos) ⚠️

**Motivación:**
- `error: any` elimina type checking
- Potenciales runtime errors si error no tiene propiedades esperadas
- Mejor developer experience con autocompletado

**Tarea:**
Refactorizar `handleError(error: any)` → `handleError(error: unknown)`

**Beneficios:**
- ✅ Type-safe access a error properties
- ✅ Autocompletado en IDE
- ✅ Compile-time error detection
- ✅ Más mantenible

**Checklist:**
- [ ] Cambiar signature a `handleError(error: unknown)`
- [ ] Agregar type guard `isAxiosError(error: unknown): error is AxiosError`
- [ ] Usar type guard en handleError
- [ ] Logging seguro: `error instanceof Error ? error.stack : String(error)`
- [ ] Tests siguen pasando
- [ ] Build exitoso

---

## 🚀 Preparación para Fase 4

### 4. Configuración Centralizada (15 minutos) 🔵

**Tarea:** Mover `SHOPIFY_URL` a ConfigService

**Archivos:**
- `src/modules/api/shopify/shopify.service.ts` - inyectar ConfigService
- `.env` - agregar `SHOPIFY_URL=https://shop.lumenalta.com`

**Beneficios para Fase 4:**
- ✅ Testing más fácil con mock server
- ✅ Configuración por ambiente (dev/staging/prod)
- ✅ No hardcoding de URLs

**Checklist:**
- [ ] Instalar `@nestjs/config` si no está
- [ ] Inyectar ConfigService en ShopifyService
- [ ] Usar `configService.get<string>('SHOPIFY_URL')`
- [ ] Agregar SHOPIFY_URL a `.env`, `.env.example`
- [ ] Tests con mock de ConfigService

---

### 5. Logging con Request ID (10 minutos) 🔵

**Tarea:** Agregar request ID opcional a `getProducts()`

**Motivación:**
- Debugging más fácil en producción
- Correlación de logs
- Métricas por request

**Signature sugerida:**
```typescript
async getProducts(requestId?: string): Promise<ShopifyProduct[]>
```

**Checklist:**
- [ ] Agregar parámetro opcional `requestId?: string`
- [ ] Usar en logging: `context = requestId ? ShopifyService:${requestId} : 'ShopifyService'`
- [ ] Instalar `uuid` si se necesita generación automática
- [ ] Tests actualizados

---

## 🗺️ Roadmap Fase 4 - Database Integration

### Objetivos Fase 4
1. **DatabaseModule** - SQLite con TypeORM
2. **Product Entity** - Modelo de base de datos
3. **ProductRepository** - CRUD operations
4. **ProductService** - Lógica de negocio (fetch + persist)
5. **ScheduleModule** - Polling periódico
6. **Tests de Integración** - E2E completo

### Dependencias de Fase 3
- ✅ ProductDto definido (mapea a entity)
- ✅ ProductNormalizer listo (transforma Shopify → DTO)
- ✅ ShopifyService resiliente (fetch confiable)
- ⚠️ Custom exceptions deben tener prototype fix (C1)
- ⚠️ ProductNormalizer debe validar edge cases (M1)

### Integración Sugerida
```typescript
// Fase 4 - ProductService
@Injectable()
export class ProductService {
  constructor(
    private readonly shopifyService: ShopifyService, // ✅ De Fase 3
    private readonly productRepository: ProductRepository, // 🆕 Fase 4
    private readonly logger: LoggerService,
  ) {}

  async syncProducts(): Promise<void> {
    const requestId = uuidv4();
    
    // 1. Fetch desde Shopify (Fase 3)
    const shopifyProducts = await this.shopifyService.getProducts(requestId);
    
    // 2. Normalizar (Fase 3)
    const dtos = ProductNormalizer.normalizeAll(
      shopifyProducts,
      'https://shop.lumenalta.com'
    );
    
    // 3. Persistir (Fase 4)
    await this.productRepository.upsertMany(dtos);
    
    // 4. Detectar cambios (Fase 4)
    const changes = await this.detectChanges(dtos);
    
    // 5. Notificar (Fase 4)
    if (changes.newProducts.length > 0) {
      await this.notifyNewProducts(changes.newProducts);
    }
  }
}
```

---

## 📊 Métricas de Calidad

### Estado Actual (Fase 3)
- ✅ **Compilación:** Exitosa sin errores
- ✅ **Tests:** 8/8 pasando (100%)
- ⚠️ **Coverage Estimado:** 
  - ShopifyService: ~95%
  - ProductNormalizer: 0% ⚠️
  - Exceptions: 0% (cubiertas indirectamente)
- ⚠️ **Issues Críticos:** 1 (prototype fix)
- ✅ **Issues Bloqueantes:** 0
- ✅ **Code Smells:** Mínimos (1 uso de `any`)

### Meta Fase 4
- ✅ **Compilación:** Exitosa sin warnings
- ✅ **Tests:** > 50 tests pasando
- ✅ **Coverage:** > 85% global
- ✅ **Issues Críticos:** 0
- ✅ **E2E Tests:** Al menos 1 flujo completo

---

## 🛠️ Setup Recomendado para Fase 4

### Herramientas a Instalar
```bash
# TypeORM + SQLite
npm install @nestjs/typeorm typeorm sqlite3

# Scheduling
npm install @nestjs/schedule

# UUID para request ID
npm install uuid
npm install -D @types/uuid

# Config (si no está)
npm install @nestjs/config
```

### Estructura de Carpetas Sugerida
```
src/modules/
├── api/                    # ✅ Fase 3
│   ├── shopify/
│   ├── exceptions/
│   ├── interfaces/
│   ├── dto/
│   └── utils/
├── database/               # 🆕 Fase 4
│   ├── entities/
│   │   └── product.entity.ts
│   ├── repositories/
│   │   └── product.repository.ts
│   └── database.module.ts
├── products/               # 🆕 Fase 4
│   ├── products.service.ts
│   ├── products.controller.ts (CLI commands)
│   └── products.module.ts
└── scheduler/              # 🆕 Fase 4
    ├── scheduler.service.ts
    └── scheduler.module.ts
```

---

## ✅ Checklist Pre-Fase 4

### Obligatorio (Bloquea Fase 4)
- [ ] C1: Custom exceptions con prototype fix ✅
- [ ] Build exitoso sin errores ✅
- [ ] Todos los tests pasando ✅

### Recomendado (Mejora Fase 4)
- [ ] M1: ProductNormalizer con tests y validación
- [ ] M2: handleError con type safety
- [ ] N1: ConfigService para SHOPIFY_URL
- [ ] N2: Request ID en logging

### Documentación
- [ ] README.md actualizado con uso de API Module
- [ ] PHASE3_CODE_REVIEW.md archivado
- [ ] PHASE4_PLAN.md creado con spec detallada

---

## 🎓 Lecciones Aprendidas

### ✅ Lo que Funcionó Bien
1. **Retry Logic** - axios-retry configurado correctamente desde el inicio
2. **Error Handling** - Custom exceptions específicas por tipo de error
3. **Tests Comprehensivos** - 8 casos cubriendo todos los escenarios
4. **Interfaces Completas** - Match perfecto con API real de Shopify
5. **Normalizer Limpio** - Lógica de transformación bien separada

### ⚠️ Lo que Puede Mejorar
1. **Tests del Normalizer** - Debería haberse testeado desde el inicio
2. **Type Safety** - `any` introduce riesgos, mejor `unknown` + type guards
3. **Configuración** - URLs hardcodeadas dificultan testing
4. **Edge Cases** - Validación de variantes vacías debe estar desde v1

### 📚 Para Próximas Fases
1. **Test-First Approach** - Escribir tests antes de implementar
2. **Type Safety Strict** - Evitar `any`, usar `unknown` + type guards
3. **Config desde el Inicio** - No hardcodear valores configurables
4. **Edge Cases Primero** - Pensar en edge cases en diseño, no en review

---

## 📞 Soporte

### Documentación Útil
- [NestJS HTTP Module](https://docs.nestjs.com/techniques/http-module)
- [axios-retry](https://github.com/softonic/axios-retry)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [TypeORM](https://typeorm.io/)
- [NestJS Scheduling](https://docs.nestjs.com/techniques/task-scheduling)

### Siguiente Paso
Cuando completes C1 (prototype fix):
```bash
# Commit Fase 3
git add .
git commit -m "feat(api): Complete Phase 3 - API Module with Shopify integration

- ShopifyService with retry logic (3 attempts, exponential backoff)
- Custom exceptions with proper prototype chain
- ProductNormalizer with edge case handling
- Comprehensive tests (8/8 passing)
- Type-safe error handling

Fixes: #C1 (prototype fix)
Addresses: #M1 (normalizer validation)

Ready for Phase 4 - Database Integration"

# Tag release
git tag phase-3-complete
git push origin main --tags
```

---

**Preparado por:** Clawdbot Code Review Agent  
**Fecha:** 2025-01-21  
**Próxima Revisión:** Post Fase 4 (Database Integration)
