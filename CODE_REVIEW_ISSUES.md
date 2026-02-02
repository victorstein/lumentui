# 🐛 LumentuiAPI v1.0.0 - Code Review Issues

**Generated:** 2026-02-02 11:02:00 UTC  
**Review Scope:** Complete codebase (44 files)  
**Total Issues:** 12 (0 Critical, 3 High, 5 Medium, 4 Low)

---

## Issue Index

### 🔴 Critical (0)
- None ✅

### 🟠 High Priority (3)
- [Issue #1](#issue-1-test-framework-mismatch-in-usedaemonspects) - Test Framework Mismatch
- [Issue #2](#issue-2-cookie-expiration-not-validated) - Cookie Expiration Not Validated
- [Issue #3](#issue-3-ipc-socket-not-cleaned-up-on-error) - IPC Socket Not Cleaned Up on Error

### 🟡 Medium Priority (5)
- [Issue #4](#issue-4-hardcoded-socket-path) - Hardcoded Socket Path
- [Issue #5](#issue-5-no-health-check-endpoint) - No Health Check Endpoint
- [Issue #6](#issue-6-missing-input-validation-on-cli) - Missing Input Validation on CLI
- [Issue #7](#issue-7-database-migrations-not-version-controlled) - Database Migrations Not Version-Controlled
- [Issue #8](#issue-8-rate-limit-cache-lost-on-restart) - Rate Limit Cache Lost on Restart

### 🟢 Low Priority (4)
- [Issue #9](#issue-9-code-duplication-in-normalizers) - Code Duplication in Normalizers
- [Issue #10](#issue-10-incomplete-typescript-strict-mode) - Incomplete TypeScript Strict Mode
- [Issue #11](#issue-11-missing-jsdoc-on-some-public-methods) - Missing JSDoc on Some Public Methods
- [Issue #12](#issue-12-consolewarn-in-production-code) - console.warn in Production Code

---

## 🟠 High Priority Issues

---

### Issue #1: Test Framework Mismatch in useDaemon.spec.ts

**Severity:** 🟠 High Priority (BLOCKER for clean test run)  
**Category:** Testing / Configuration  
**Module:** TUI (ui/hooks)

#### Location
- **File:** `src/ui/hooks/useDaemon.spec.ts`
- **Line:** 1
- **Function:** Import statements

#### Description
The test file `useDaemon.spec.ts` imports test utilities from `vitest` instead of `jest`, which is the configured test runner for this project. This causes the test suite to fail with:

```
Cannot find module 'vitest' from 'ui/hooks/useDaemon.spec.ts'
```

#### Impact
- ❌ Test suite fails: "1 failed, 7 passed, 8 total"
- ❌ Claimed 90 tests passing is misleading (should be 90 passing, 1 suite failed)
- ❌ CI/CD pipeline would fail if configured
- ⚠️ Production code unaffected (runtime works fine)
- ⚠️ Reduces confidence in TUI hook testing

#### Root Cause
Developer used `vitest` during TUI development but project standardized on `jest`. Test file was not updated when switching test frameworks.

#### Evidence
```typescript
// Current (WRONG):
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Expected:
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
// or just rely on Jest globals
```

#### Suggested Fix

**Option 1: Update imports (recommended)**
```typescript
// src/ui/hooks/useDaemon.spec.ts
import { renderHook, act } from '@testing-library/react';
// Remove vitest import, use Jest globals

describe('useDaemon', () => {
  // Change vi.fn() to jest.fn()
  // Change vi.mock() to jest.mock()
  // etc.
```

**Option 2: Add vitest as dev dependency (not recommended)**
```bash
npm install -D vitest
```
This would add unnecessary complexity since the rest of the project uses Jest.

#### Testing Required
After fix:
```bash
npm test
# Should show: Test Suites: 8 passed, 8 total
# Should show: Tests: 90 passed, 90 total
```

#### Effort Estimate
- **Time:** 5-10 minutes
- **Risk:** Low (mechanical find/replace)
- **Dependencies:** None

#### Priority Justification
Marked as HIGH because:
1. Blocks clean test run
2. Simple to fix
3. Should be fixed before git push
4. Creates confusion about test status

---

### Issue #2: Cookie Expiration Not Validated

**Severity:** 🟠 High Priority  
**Category:** Authentication / Logic Bug  
**Module:** AuthModule (auth.service.ts)

#### Location
- **File:** `src/modules/auth/auth.service.ts`
- **Lines:** 148-159 (parseCookieHeader method)
- **Function:** `loadCookies()`, `parseCookieHeader()`, `isCookieExpired()`

#### Description
The cookie expiration validation logic is ineffective because the `parseCookieHeader()` method always sets `expires: 0` for cookies parsed from the stored cookie header format. This means the `isCookieExpired()` check always returns `false`, even for expired cookies.

#### Impact
- ⚠️ Expired cookies not detected until API call fails (401/403)
- ⚠️ Poor user experience (confusing error messages)
- ⚠️ Unnecessary API calls with expired credentials
- ⚠️ "Session expired" warning never triggered proactively
- ✅ System eventually recovers (API error triggers re-auth prompt)

#### Root Cause
Cookie header format `"name1=value1; name2=value2"` doesn't include expiration metadata. When cookies are saved via `saveCookies()`, only the header string is stored, discarding the original Cookie objects with their `expires` field.

#### Evidence
```typescript
// Current code (WRONG):
private parseCookieHeader(cookieHeader: string): Cookie[] {
  const parts = cookieHeader.split('; ');
  return parts.map((part) => {
    const [name, value] = part.split('=');
    return {
      name,
      value,
      domain: '',
      path: '/',
      expires: 0, // ❌ Always 0 = "never expires"
    } as Cookie;
  });
}

private isCookieExpired(cookie: Cookie): boolean {
  if (!cookie.expires) return false; // ❌ Always false
  return cookie.expires < Date.now() / 1000;
}
```

#### Suggested Fix

**Option 1: Store full Cookie objects (recommended)**
```typescript
// auth.service.ts
async saveCookies(cookies: Cookie[]): Promise<void> {
  // Store full Cookie array as JSON, not just header string
  const cookieData = {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires, // ✅ Preserve expiration
      httpOnly: c.httpOnly,
      secure: c.secure,
    })),
    storedAt: Date.now(),
  };
  
  this.cookieStorage.saveCookies(JSON.stringify(cookieData));
}

async loadCookies(): Promise<string> {
  const stored = this.cookieStorage.loadCookies();
  if (!stored) {
    throw new AuthException('No cookies found...');
  }
  
  const cookieData = JSON.parse(stored);
  
  // ✅ Now we can actually validate expiration
  const expiredCookies = cookieData.cookies.filter(c => 
    c.expires && c.expires < Date.now() / 1000
  );
  
  if (expiredCookies.length > 0) {
    throw new AuthException('Session expired. Please re-authenticate...');
  }
  
  // Convert back to header format for API calls
  return cookieData.cookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}
```

**Option 2: Store expiration separately**
```typescript
// cookie-storage.service.ts
interface StoredCookieData {
  cookieHeader: string;
  expiresAt: number; // Earliest expiration of all cookies
  storedAt: number;
}
```

#### Testing Required
```typescript
// Add test case to auth.service.spec.ts
it('should throw AuthException when cookies are expired', async () => {
  const expiredCookie = {
    name: 'storefront_digest',
    value: 'test',
    expires: Date.now() / 1000 - 3600, // Expired 1 hour ago
  };
  
  (cookieStorageService.loadCookies as jest.Mock).mockReturnValue(
    JSON.stringify({ cookies: [expiredCookie] })
  );
  
  await expect(service.loadCookies()).rejects.toThrow(AuthException);
  await expect(service.loadCookies()).rejects.toThrow('Session expired');
});
```

#### Effort Estimate
- **Time:** 2-3 hours (including testing)
- **Risk:** Medium (changes storage format, needs migration)
- **Dependencies:** CookieStorageService (may need updates)

#### Backward Compatibility
⚠️ **Breaking change** - old cookie files won't work. Need migration:

```typescript
// Detect old format and migrate
const stored = this.cookieStorage.loadCookies();
if (stored && !stored.includes('{')) {
  // Old format (just header string)
  // Force re-authentication or set default expiration
  throw new AuthException('Cookie format outdated. Please re-authenticate...');
}
```

#### Priority Justification
Marked as HIGH because:
1. User experience issue (confusing errors)
2. Wastes API calls
3. Security consideration (stale credentials)
4. Not a trivial fix (needs storage format change)

---

### Issue #3: IPC Socket Not Cleaned Up on Error

**Severity:** 🟠 High Priority  
**Category:** Reliability / Error Handling  
**Module:** IpcModule (ipc.gateway.ts)

#### Location
- **File:** `src/modules/ipc/ipc.gateway.ts`
- **Lines:** 36-46 (startServer method)
- **Function:** `startServer()`

#### Description
When the IPC server crashes or is killed ungracefully (SIGKILL, power loss, etc.), the Unix socket file `/tmp/lumentui.sock` remains on disk. On next startup, `ipc.serve()` fails with "address already in use" error, preventing daemon startup.

#### Impact
- ❌ Daemon won't start after crash (requires manual intervention)
- ❌ Poor recovery experience
- ⚠️ Workaround exists: `rm /tmp/lumentui.sock` manually
- ⚠️ Affects development workflow (restarts during debugging)
- ✅ Doesn't affect running daemon (only startup)

#### Root Cause
`node-ipc` doesn't automatically clean up stale socket files. The server checks if port is in use but doesn't verify if the process actually exists.

#### Evidence
```typescript
// Current code (NO CLEANUP):
private startServer(): void {
  if (this.isServerRunning) {
    this.logger.warn('IPC server already running');
    return;
  }

  ipc.config.id = 'lumentui-daemon';
  ipc.config.retry = 1500;
  ipc.config.silent = true;

  ipc.serve(this.socketPath, () => {
    this.setupEventHandlers();
  });

  ipc.server.start(); // ❌ Fails if socket exists
  // ...
}
```

#### Suggested Fix

**Option 1: Check and remove stale socket (recommended)**
```typescript
import { existsSync, unlinkSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

private async startServer(): Promise<void> {
  if (this.isServerRunning) {
    this.logger.warn('IPC server already running');
    return;
  }

  // ✅ Clean up stale socket file
  await this.cleanupStaleSocket();

  ipc.config.id = 'lumentui-daemon';
  // ... rest of setup
}

private async cleanupStaleSocket(): Promise<void> {
  if (!existsSync(this.socketPath)) {
    return; // Nothing to clean up
  }

  // Check if a process is actually listening on this socket
  try {
    await execAsync(`lsof ${this.socketPath}`);
    // Socket is in use by a running process
    this.logger.warn('IPC socket is in use by another process');
    throw new Error('IPC socket already in use');
  } catch (error) {
    // lsof returns non-zero if socket is not in use
    // Socket file exists but no process listening = stale
    this.logger.log('Removing stale IPC socket file');
    unlinkSync(this.socketPath);
  }
}
```

**Option 2: Use PID-based locking (more complex)**
```typescript
// Create lock file with PID
// Check if PID is still running before deleting socket
```

#### Testing Required
```typescript
// Manual test:
1. Start daemon
2. Kill with SIGKILL: kill -9 <pid>
3. Verify /tmp/lumentui.sock exists
4. Start daemon again
5. Should start successfully (socket cleaned up)

// Unit test:
it('should clean up stale socket on startup', async () => {
  // Create fake socket file
  fs.writeFileSync('/tmp/test.sock', '');
  
  // Mock lsof to return error (socket not in use)
  jest.spyOn(child_process, 'exec').mockImplementation((cmd, callback) => {
    callback(new Error('not found'), '', '');
  });
  
  await gateway.startServer();
  
  expect(fs.existsSync('/tmp/test.sock')).toBe(false);
});
```

#### Effort Estimate
- **Time:** 30-45 minutes (including testing)
- **Risk:** Low (only affects startup, well-tested pattern)
- **Dependencies:** fs, child_process (already available)

#### Related Issues
- See Issue #4 (hardcoded socket path) - should fix together
- Consider adding `--force` flag to CLI to override lock

#### Priority Justification
Marked as HIGH because:
1. Blocks daemon startup after crash
2. Common development scenario (frequent restarts)
3. Poor user experience (manual intervention required)
4. Standard pattern with known solution

---

## 🟡 Medium Priority Issues

---

### Issue #4: Hardcoded Socket Path

**Severity:** 🟡 Medium Priority  
**Category:** Configuration / Flexibility  
**Module:** IpcModule (ipc.gateway.ts)

#### Location
- **File:** `src/modules/ipc/ipc.gateway.ts`
- **Line:** 19
- **Constant:** `private readonly socketPath = '/tmp/lumentui.sock';`

#### Description
IPC socket path is hardcoded to `/tmp/lumentui.sock`, preventing:
- Running multiple instances (dev + prod)
- Custom socket locations for security/organization
- Testing with isolated sockets
- Deployment flexibility (some systems don't allow /tmp writes)

#### Impact
- ⚠️ Can't run multiple instances simultaneously
- ⚠️ Testing requires cleanup between runs
- ⚠️ Less flexible for deployment scenarios
- ✅ Works fine for single-instance use case
- ✅ /tmp is standard location for Unix sockets

#### Suggested Fix
```typescript
// ipc.gateway.ts
export class IpcGateway {
  private readonly socketPath: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.socketPath = this.configService.get<string>(
      'IPC_SOCKET_PATH',
      '/tmp/lumentui.sock', // Default fallback
    );
  }
  
  // ... rest of class
}

// .env.example
IPC_SOCKET_PATH=/tmp/lumentui.sock              # Unix socket path for IPC communication
```

#### Effort Estimate
- **Time:** 15 minutes
- **Risk:** Very low
- **Breaking Change:** No (maintains default)

#### Priority Justification
Medium because it improves flexibility but current hardcoded value works for primary use case.

---

### Issue #5: No Health Check Endpoint

**Severity:** 🟡 Medium Priority  
**Category:** Monitoring / Documentation Mismatch  
**Module:** AppModule (missing feature)

#### Location
- **Expected:** `src/app.controller.ts` or separate `health.controller.ts`
- **Documented:** `.env.example` lines 51-52, DEPLOYMENT.md
- **Current:** Not implemented

#### Description
Documentation mentions health check configuration:
```bash
# .env.example
HEALTH_CHECK_ENABLED=false
HEALTH_CHECK_PORT=3000
```

But there's no actual HTTP server or `/health` endpoint implemented.

#### Impact
- ⚠️ Can't monitor daemon health via HTTP (must use IPC or process checks)
- ⚠️ Documentation misleading
- ⚠️ PM2 can't use HTTP health checks
- ✅ Alternative monitoring works (pm2 status, IPC ping)
- ✅ Not critical for single-instance deployment

#### Suggested Fix

**Option 1: Remove documentation (quick fix)**
```bash
# Remove HEALTH_CHECK_* from .env.example
# Remove health check section from DEPLOYMENT.md
```

**Option 2: Implement health check (better)**
```typescript
// src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerService: SchedulerService,
    private readonly ipcGateway: IpcGateway,
  ) {}

  @Get()
  getHealth() {
    const status = this.schedulerService.getStatus();
    const ipcStatus = this.ipcGateway.getStatus();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      polling: {
        active: status.isPolling,
        lastPoll: status.lastPoll,
      },
      ipc: {
        running: ipcStatus.isRunning,
        socket: ipcStatus.socketPath,
      },
    };
  }
}

// main.ts - make it conditional
const healthEnabled = configService.get('HEALTH_CHECK_ENABLED') === 'true';
if (healthEnabled) {
  const port = configService.get('HEALTH_CHECK_PORT', 3000);
  await app.listen(port);
  logger.log(`Health check endpoint available at http://localhost:${port}/health`);
}
```

#### Effort Estimate
- **Option 1 (remove docs):** 5 minutes
- **Option 2 (implement):** 1-2 hours
- **Risk:** Low for either option

#### Priority Justification
Medium because:
- Documentation mismatch should be fixed
- Health checks are nice-to-have, not critical
- Alternative monitoring exists

---

### Issue #6: Missing Input Validation on CLI

**Severity:** 🟡 Medium Priority  
**Category:** User Experience / Error Handling  
**Module:** CLI (cli.ts)

#### Location
- **File:** `src/cli.ts`
- **Lines:** Various (auth, start, stop commands)
- **Functions:** Command handlers

#### Description
CLI commands don't validate user input before processing:
- Phone numbers (format, length)
- File paths (existence, permissions)
- Environment values (valid enum values)
- Numeric parameters (poll interval, timeouts)

#### Impact
- ⚠️ Confusing error messages when invalid input provided
- ⚠️ Errors occur deep in the stack instead of at input
- ⚠️ Poor user experience
- ✅ Application doesn't crash (NestJS validation catches most)
- ✅ Environment file prevents most invalid configs

#### Examples of Missing Validation
```typescript
// No validation on phone number format
NOTIFICATION_PHONE=invalid  // Should be E.164 format

// No validation on paths
DB_PATH=/nonexistent/path/db.sqlite  // Should check parent dir exists

// No validation on intervals
LUMENTUI_POLL_INTERVAL=abc  // Should be numeric

// No validation on log levels
LOG_LEVEL=invalid  // Should be debug|info|warn|error
```

#### Suggested Fix
```typescript
// cli.ts - Add validation helpers
import validator from 'validator';

function validatePhoneNumber(phone: string): boolean {
  if (!phone.startsWith('+')) {
    console.error('❌ Phone number must be in E.164 format (e.g., +50586826131)');
    return false;
  }
  if (!validator.isMobilePhone(phone, 'any', { strictMode: true })) {
    console.error('❌ Invalid phone number format');
    return false;
  }
  return true;
}

function validatePath(path: string, shouldExist: boolean = false): boolean {
  if (shouldExist && !fs.existsSync(path)) {
    console.error(`❌ Path does not exist: ${path}`);
    return false;
  }
  // Check parent directory is writable
  const dir = path.dirname(path);
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    console.error(`❌ Directory not writable: ${dir}`);
    return false;
  }
}

// Use in commands:
program
  .command('start')
  .action(async (options) => {
    // Validate config before starting
    const phone = process.env.NOTIFICATION_PHONE;
    if (phone && !validatePhoneNumber(phone)) {
      process.exit(1);
    }
    
    // ... rest of command
  });
```

#### Effort Estimate
- **Time:** 1-2 hours (add validation to all commands)
- **Risk:** Low
- **Dependencies:** `validator` library (optional)

#### Priority Justification
Medium because:
- Improves user experience significantly
- Prevents confusing error messages
- Not critical (errors are caught eventually)

---

### Issue #7: Database Migrations Not Version-Controlled

**Severity:** 🟡 Medium Priority  
**Category:** Maintainability / Schema Management  
**Module:** StorageModule (database.service.ts)

#### Location
- **File:** `src/modules/storage/database/database.service.ts`
- **Lines:** 48-92 (runMigrations method)
- **Method:** `runMigrations()`

#### Description
Database schema is created inline in `runMigrations()` with `CREATE TABLE IF NOT EXISTS`. There's no:
- Migration version tracking
- Schema change history
- Rollback capability
- Migration ordering
- Data migration support

#### Impact
- ⚠️ Hard to evolve schema (no versioning)
- ⚠️ Can't rollback schema changes
- ⚠️ Can't track what migrations ran
- ⚠️ Data migrations require manual scripts
- ✅ Works fine for initial deployment
- ✅ Simple schema (low churn expected)

#### Current Approach (Inline)
```typescript
private runMigrations() {
  this.db.exec(`CREATE TABLE IF NOT EXISTS products (...)`);
  this.db.exec(`CREATE TABLE IF NOT EXISTS polls (...)`);
  this.db.exec(`CREATE INDEX IF NOT EXISTS ...`);
  // ❌ No version tracking
  // ❌ Can't rollback
  // ❌ Can't add data migrations
}
```

#### Suggested Fix

**Option 1: Simple migration system**
```typescript
// migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS products (...);
CREATE TABLE IF NOT EXISTS polls (...);
-- ...

// migrations/002_add_notification_index.sql
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(sent, timestamp);

// database.service.ts
private runMigrations() {
  // Create migrations table
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
  
  // Get applied migrations
  const applied = new Set(
    this.db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map(r => r.name)
  );
  
  // Apply pending migrations
  const migrations = fs.readdirSync('migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of migrations) {
    if (!applied.has(file)) {
      const sql = fs.readFileSync(`migrations/${file}`, 'utf-8');
      this.db.exec(sql);
      this.db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
        .run(file, Date.now());
      this.logger.log(`Applied migration: ${file}`);
    }
  }
}
```

**Option 2: Use TypeORM migrations**
```bash
npm install typeorm
# Convert to TypeORM entities
# Use typeorm migration:generate and migration:run
```

#### Effort Estimate
- **Option 1 (simple):** 3-4 hours
- **Option 2 (TypeORM):** 8+ hours (full refactor)
- **Risk:** Medium (requires testing migration flow)

#### Priority Justification
Medium because:
- Current approach works for v1.0.0
- Schema is unlikely to change frequently
- Important for long-term maintainability
- Not urgent for initial release

---

### Issue #8: Rate Limit Cache Lost on Restart

**Severity:** 🟡 Medium Priority  
**Category:** Reliability / State Management  
**Module:** NotificationModule (notification.service.ts)

#### Location
- **File:** `src/modules/notification/notification.service.ts`
- **Line:** 17
- **Variable:** `private readonly notificationCache: Map<string, number>`

#### Description
Notification rate limiting uses an in-memory `Map` that is lost when the daemon restarts. This means users may receive duplicate notifications for products they were already notified about (within the 60-minute window) if a restart occurs.

#### Impact
- ⚠️ Duplicate notifications possible after restart
- ⚠️ Rate limit effectiveness reduced
- ⚠️ Slightly annoying user experience
- ✅ Database records notification history (could rebuild cache)
- ✅ Rate limit window resets naturally (not catastrophic)
- ✅ Doesn't affect functionality, only prevents spam

#### Current Implementation
```typescript
export class NotificationService {
  private readonly notificationCache: Map<string, number> = new Map();
  // ❌ Lost on restart
  
  private isRateLimited(productId: string): boolean {
    const lastNotification = this.notificationCache.get(productId);
    if (!lastNotification) return false;
    
    const minutesSince = (Date.now() - lastNotification) / (1000 * 60);
    return minutesSince < RATE_LIMIT_MINUTES;
  }
}
```

#### Suggested Fix

**Option 1: Rebuild cache from database on startup**
```typescript
export class NotificationService implements OnModuleInit {
  private readonly notificationCache: Map<string, number> = new Map();
  
  async onModuleInit() {
    // ✅ Rebuild rate limit cache from recent notifications
    const recentThreshold = Date.now() - (RATE_LIMIT_MINUTES * 60 * 1000);
    const recentNotifications = this.databaseService
      .getDatabase()
      .prepare(`
        SELECT product_id, MAX(timestamp) as last_sent
        FROM notifications
        WHERE sent = 1 AND timestamp > ?
        GROUP BY product_id
      `)
      .all(recentThreshold);
    
    for (const row of recentNotifications) {
      this.notificationCache.set(row.product_id, row.last_sent);
    }
    
    this.logger.log(
      `Rate limit cache initialized with ${recentNotifications.length} entries`,
      'NotificationService'
    );
  }
  
  // ... rest of service
}
```

**Option 2: Check database instead of cache**
```typescript
private isRateLimited(productId: string): boolean {
  // Check both cache and database
  const cached = this.notificationCache.get(productId);
  if (cached && (Date.now() - cached) / (1000 * 60) < RATE_LIMIT_MINUTES) {
    return true;
  }
  
  // ✅ Fallback to database query
  const recent = this.databaseService
    .getDatabase()
    .prepare(`
      SELECT timestamp FROM notifications
      WHERE product_id = ? AND sent = 1
      ORDER BY timestamp DESC
      LIMIT 1
    `)
    .get(productId);
  
  if (recent) {
    const minutesSince = (Date.now() - recent.timestamp) / (1000 * 60);
    return minutesSince < RATE_LIMIT_MINUTES;
  }
  
  return false;
}
```

#### Effort Estimate
- **Option 1 (rebuild cache):** 30 minutes
- **Option 2 (check database):** 45 minutes
- **Risk:** Low (additive change, no breaking)

#### Priority Justification
Medium because:
- Only affects edge case (restart during rate limit window)
- Workaround exists (users can ignore duplicate)
- Easy to fix
- Improves reliability

---

## 🟢 Low Priority Issues

---

### Issue #9: Code Duplication in Normalizers

**Severity:** 🟢 Low Priority  
**Category:** Maintainability / Code Quality  
**Module:** ApiModule + StorageModule

#### Location
- **File 1:** `src/modules/api/utils/normalizer.util.ts`
- **File 2:** `src/modules/storage/utils/storage-normalizer.util.ts`

#### Description
Similar normalization logic exists in two places:
- API normalizer: Shopify JSON → ProductDto
- Storage normalizer: ProductEntity → ProductDto

Some logic could be shared or consolidated.

#### Impact
- ⚠️ Changes need to be synced between files
- ⚠️ Slight maintenance burden
- ✅ Both work correctly independently
- ✅ Minimal actual duplication (different concerns)

#### Suggested Fix
```typescript
// Create shared normalizer utilities
// src/common/utils/product-normalizer.util.ts
export class ProductNormalizerUtil {
  static normalizePrice(price: string | number): number {
    // Shared logic
  }
  
  static normalizeImages(images: any[]): string[] {
    // Shared logic
  }
}
```

#### Effort Estimate
- **Time:** 30 minutes
- **Risk:** Very low

#### Priority Justification
Low because duplication is minimal and both work correctly.

---

### Issue #10: Incomplete TypeScript Strict Mode

**Severity:** 🟢 Low Priority  
**Category:** Type Safety / Configuration  
**Module:** Project Configuration (tsconfig.json)

#### Location
- **File:** `tsconfig.json`
- **Lines:** 20-21

#### Description
TypeScript strict mode is partially enabled but two checks are disabled:
```json
{
  "strictNullChecks": true,
  "strictBindCallApply": false,  // ❌ Disabled
  "noFallthroughCasesInSwitch": false,  // ❌ Disabled
  "noImplicitAny": true
}
```

#### Impact
- ⚠️ Potential runtime errors not caught at compile time
- ⚠️ Less type safety than full strict mode
- ✅ Code works correctly as-is
- ✅ Most important strict checks are enabled

#### Suggested Fix
```json
{
  "compilerOptions": {
    "strict": true,  // Enables all strict checks
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Then fix any new TypeScript errors that arise.

#### Effort Estimate
- **Time:** 2-3 hours (fixing violations)
- **Risk:** Low (compile-time only)

#### Priority Justification
Low because current configuration provides good type safety and code works correctly.

---

### Issue #11: Missing JSDoc on Some Public Methods

**Severity:** 🟢 Low Priority  
**Category:** Documentation / Code Quality  
**Module:** Various

#### Description
Some public methods lack JSDoc comments, particularly in:
- IpcGateway event emitters
- CLI utility functions
- Some service methods

#### Impact
- ⚠️ Slightly harder to understand code without IDE hints
- ⚠️ API documentation would be incomplete
- ✅ Method names are self-explanatory
- ✅ Complex logic has inline comments

#### Suggested Fix
Add JSDoc to all public methods:
```typescript
/**
 * Emit heartbeat event to all connected IPC clients
 * Should be called at the end of each successful poll
 * 
 * @param timestamp Unix timestamp in milliseconds
 */
emitHeartbeat(timestamp: number): void {
  // ...
}
```

#### Effort Estimate
- **Time:** 2 hours (add ~20-30 JSDoc blocks)
- **Risk:** None (documentation only)

#### Priority Justification
Low because:
- Code is readable without docs
- Most critical methods already documented
- Nice-to-have improvement

---

### Issue #12: console.warn in Production Code

**Severity:** 🟢 Low Priority  
**Category:** Logging / Consistency  
**Module:** CLI (cli.ts)

#### Location
- **File:** `src/cli.ts`
- **Lines:** 150, 167, 183

#### Description
CLI code uses `console.warn()` instead of `LoggerService.warn()`:
```typescript
console.warn('⚠️  Daemon started but IPC not responding');
console.warn('⚠️  TUI not built yet. Run: npm run build');
console.warn('⚠️  Daemon did not stop gracefully, forcing...');
```

#### Impact
- ⚠️ Inconsistent with rest of codebase (uses LoggerService)
- ⚠️ These warnings not captured in log files
- ✅ CLI output to console is appropriate here
- ✅ User sees the messages correctly

#### Suggested Fix

**Option 1: Keep console.warn (CLI is special)**
```typescript
// CLI output is intentionally direct to console
// This is actually fine for CLI commands
```

**Option 2: Use LoggerService**
```typescript
// Bootstrap logger for CLI commands
const app = await NestFactory.createApplicationContext(AppModule);
const logger = app.get(LoggerService);

logger.warn('Daemon started but IPC not responding');
```

#### Effort Estimate
- **Time:** 15 minutes
- **Risk:** Very low

#### Priority Justification
Low because:
- CLI output to console is arguably correct behavior
- User sees the messages
- Minor consistency issue

---

## 📊 Issue Summary Statistics

### By Severity
| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | 0 | 0% |
| 🟠 High | 3 | 25% |
| 🟡 Medium | 5 | 42% |
| 🟢 Low | 4 | 33% |
| **Total** | **12** | **100%** |

### By Category
| Category | Count |
|----------|-------|
| Testing / Configuration | 2 |
| Authentication / Security | 1 |
| Error Handling / Reliability | 2 |
| Configuration / Flexibility | 1 |
| Monitoring / Documentation | 1 |
| User Experience | 1 |
| Maintainability / Schema | 1 |
| State Management | 1 |
| Code Quality | 2 |

### By Effort (Time to Fix)
| Effort | Issue Count |
|--------|-------------|
| < 1 hour | 7 |
| 1-2 hours | 3 |
| 2-4 hours | 1 |
| > 4 hours | 1 |

### Total Estimated Effort: **~15-20 hours**

---

## 🎯 Recommended Fix Priority

### Pre-Push (Critical Path)
1. **Issue #1** - Fix test framework (5 min) ✅ MUST DO

### Post-Push (Week 1)
2. **Issue #3** - IPC socket cleanup (30 min)
3. **Issue #4** - Configurable socket path (15 min)
4. **Issue #2** - Cookie expiration (2 hours)

### Post-Push (Week 2-4)
5. **Issue #6** - CLI validation (1 hour)
6. **Issue #8** - Rate limit cache (30 min)
7. **Issue #5** - Health check or remove docs (1 hour)

### Future Enhancements
8. **Issue #7** - Migration system (4 hours)
9. **Issue #10** - Full strict mode (2 hours)
10. **Issue #9** - Consolidate normalizers (30 min)
11. **Issue #11** - Complete JSDoc (2 hours)
12. **Issue #12** - Logger consistency (15 min)

---

## 📝 Notes

### Why No Critical Issues?
The codebase has no critical/blocking issues because:
1. All core functionality tested and working
2. Error handling comprehensive
3. Security practices sound
4. Production deployment viable as-is

The issues identified are **quality-of-life improvements** and **maintainability enhancements**, not functional blockers.

### Test Framework Issue Caveat
Issue #1 (test framework mismatch) is technically a "test blocker" but doesn't affect production functionality. It's high priority because it's trivial to fix and should be done before push.

---

**End of Issues Report**
