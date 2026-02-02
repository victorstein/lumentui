# 🧪 Fase 7: Integration & Testing - Plan de Ejecución

**Status:** ⏳ WAITING FOR PHASES 5-6  
**Monitoring started:** 2026-02-02 10:13:24 UTC  
**Expected dependencies:**
- ✗ `src/scheduler/scheduler.service.ts` (Fase 5)
- ✗ `src/notification/notification.service.ts` (Fase 6)

---

## 📋 Tasks Overview (lumentui-33n.14 - lumentui-33n.16)

### ✅ Pre-requisites
- [x] Fase 1-4 completed (Auth, API, Storage)
- [ ] Fase 5 completed (Scheduler/Poller)
- [ ] Fase 6 completed (Notification)

---

## 🎯 Task 1: Integration Tests (lumentui-33n.14)

### Objetivo
Test end-to-end completo del flujo: poll → scrape → save → notification

### Archivo a crear
`test/integration/app.e2e-spec.ts`

### Test Cases
```typescript
describe('LumenTUI E2E Integration Tests', () => {
  
  describe('Complete Flow: Poll → Scrape → Save → Notify', () => {
    it('should poll product, scrape data, save to DB, and send notification', async () => {
      // 1. Mock Shopify API response (Frieren BD real product)
      // 2. Trigger scheduler poll
      // 3. Verify product saved in DB
      // 4. Verify notification sent
      // 5. Cleanup test data
    });
  });
  
  describe('Product Change Detection', () => {
    it('should detect new product and trigger notification', async () => {
      // Test new product detection logic
    });
    
    it('should detect price change and trigger notification', async () => {
      // Test price change detection
    });
    
    it('should NOT notify for unchanged products', async () => {
      // Test no-op scenario
    });
  });
  
  describe('Error Handling', () => {
    it('should handle Shopify API errors gracefully', async () => {
      // Test 401, 429, 500 errors
    });
    
    it('should handle database errors without crashing', async () => {
      // Test DB connection failures
    });
  });
  
  describe('Database Persistence', () => {
    it('should persist products across polls', async () => {
      // Test data integrity
    });
    
    it('should use test database (data/test-lumentui.db)', async () => {
      // Verify isolation
    });
  });
  
});
```

### Test Product Data
**Real product:** Frieren: Beyond Journey's End Blu-ray Box Set
```typescript
const testProduct = {
  id: '8791472128323',
  title: 'Frieren: Beyond Journey\'s End Blu-ray Box Set',
  handle: 'frieren-beyond-journeys-end-blu-ray-box-set',
  price: '99.99',
  available: true,
  url: 'https://shop.lumenalta.com/products/frieren-beyond-journeys-end-blu-ray-box-set'
};
```

### Setup Requirements
- Test database: `data/test-lumentui.db` (auto-cleanup)
- Mock Shopify API responses
- Disable real notifications in test mode
- Use TestingModule from @nestjs/testing

---

## 📝 Task 2: Manual Testing (lumentui-33n.15)

### Objetivo
Ejecutar poll manual y verificar sistema completo funcionando

### Steps
1. **Setup test environment**
   ```bash
   cp .env .env.test
   # Set TEST_MODE=true
   # Set DB_PATH=data/test-lumentui.db
   ```

2. **Run manual poll**
   ```bash
   npm run start:dev
   # Trigger manual poll via CLI or API
   ```

3. **Verify checklist:**
   - [ ] Product data scraped from Shopify
   - [ ] Data persisted in DB (check with sqlite3)
   - [ ] Logs showing correct flow in console
   - [ ] Scheduler configured correctly (check intervals)
   - [ ] No errors in console

4. **Database verification**
   ```bash
   sqlite3 data/test-lumentui.db "SELECT * FROM products;"
   ```

5. **Log verification**
   - Check Winston logs
   - Verify timestamps
   - Verify log levels (info, warn, error)

### Documentation
Create `test/MANUAL_TEST_RESULTS.md` with:
- Test date/time
- Test product used
- Screenshots (if applicable)
- Logs output
- Pass/Fail for each verification item
- Issues found (if any)

---

## 🎨 Task 3: Code Quality (lumentui-33n.16)

### Objetivo
Ensure code quality, coverage, and build stability

### Sub-tasks

#### 3.1 Linting
```bash
npm run lint
# Fix all issues
```

**Target:** Zero lint errors/warnings

#### 3.2 Test Coverage
```bash
npm run test:cov
```

**Targets:**
- Global coverage: > 80%
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

**Coverage report location:** `coverage/lcov-report/index.html`

#### 3.3 Build Verification
```bash
npm run build
```

**Target:** Zero TypeScript errors

#### 3.4 Code Smells Review
Manually review:
- Unused imports
- Dead code
- Magic numbers/strings
- TODO/FIXME comments
- Console.log statements (should use Logger)

### Documentation
Create/update `docs/TESTING.md` with:
- Coverage summary table
- Lint results
- Build verification
- Code smell findings
- Recommendations for improvement

---

## 📊 Deliverables Checklist

- [ ] `test/integration/app.e2e-spec.ts` created
- [ ] All integration tests passing
- [ ] `test/MANUAL_TEST_RESULTS.md` documented
- [ ] Coverage > 80% global
- [ ] Lint clean (zero errors)
- [ ] Build successful (zero TS errors)
- [ ] `docs/TESTING.md` updated
- [ ] All code staged (NO commit yet)

---

## 🚀 Execution Order

1. **Wait for dependencies** (current step)
   - Monitor for scheduler.service.ts
   - Monitor for notification.service.ts

2. **Verify Phases 5-6 implementation**
   - Run existing unit tests
   - Check module exports
   - Verify integration points

3. **Create integration tests** (Task 1)
   - Write test cases
   - Setup test database
   - Mock external dependencies
   - Run tests, verify passing

4. **Manual testing** (Task 2)
   - Execute manual poll
   - Verify all components
   - Document results

5. **Code quality** (Task 3)
   - Run lint
   - Generate coverage report
   - Run build
   - Document findings

6. **Final verification**
   - All tests passing
   - All deliverables ready
   - Code staged for review

---

## ⚠️ Important Notes

- **NO COMMITS** until all tasks complete
- Use test database (data/test-lumentui.db) with auto-cleanup
- TypeScript strict mode enforced
- All external APIs should be mocked in tests
- Real Shopify API only for manual testing

---

## 🔧 Test Database Setup

```typescript
// test/setup.ts
import { DatabaseService } from '../src/modules/storage/database/database.service';

export async function setupTestDatabase() {
  const db = new DatabaseService({
    path: 'data/test-lumentui.db',
    migrations: true
  });
  
  await db.onModuleInit();
  return db;
}

export async function cleanupTestDatabase(db: DatabaseService) {
  await db.onModuleDestroy();
  // Optional: delete test DB file
}
```

---

## 📈 Success Criteria

✅ All integration tests pass  
✅ Manual testing documented with screenshots/logs  
✅ Coverage > 80%  
✅ Lint clean  
✅ Build successful  
✅ Zero regressions in existing tests  
✅ Documentation complete  

---

**Status tracking:** This plan will be executed automatically when dependencies are detected.

**Estimated time:** 4-6 hours total
- Task 1: 2-3 hours
- Task 2: 1 hour
- Task 3: 1-2 hours
