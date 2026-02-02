# 📋 Code Review - Action Items

**Generado:** 2026-01-21  
**Basado en:** CODE_REVIEW_PHASE2.md

---

## 🔴 PRIORIDAD ALTA (resolver antes de Fase 3)

### [ ] 1. Fix `isCookieExpired()` dead code

**Opción A: Implementar validación de expiración**
```typescript
// auth.service.ts

async validateCookies(): Promise<boolean> {
  try {
    const cookieHeader = await this.loadCookies();
    
    // Parse cookie header back to Cookie objects
    const cookies = this.parseCookieHeader(cookieHeader);
    
    // Validate each cookie is not expired
    const allValid = cookies.every(c => !this.isCookieExpired(c));
    
    if (!allValid) {
      this.logger.warn('Cookies expired, re-authentication required', 'AuthService');
    }
    
    return allValid;
  } catch {
    return false;
  }
}

private parseCookieHeader(header: string): Cookie[] {
  // TODO: implement reverse parsing
  // For now, we only store storefront_digest, so we can retrieve the original Cookie object
  // Option: store full Cookie objects as JSON instead of header format
}
```

**Opción B: Remover dead code**
```bash
# Si decidimos no validar expiración por ahora
# Eliminar líneas 85-87 de auth.service.ts
```

**Test requerido:**
```typescript
// auth.service.spec.ts
describe('validateCookies', () => {
  it('should return false for expired cookies', async () => {
    const expiredCookie = {
      name: 'storefront_digest',
      value: 'test',
      expires: Date.now() / 1000 - 3600, // expired 1 hour ago
    };
    
    // ... rest of test
  });
});
```

---

### [ ] 2. Implementar cookie persistence durable

**Opción A: File-based con encriptación (más simple)**

```typescript
// auth.service.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

private readonly COOKIE_DIR = path.join(os.homedir(), '.lumentui');
private readonly COOKIE_FILE = path.join(this.COOKIE_DIR, 'cookies.enc');
private readonly ENCRYPTION_KEY = this.deriveKey(); // from machine ID

private deriveKey(): Buffer {
  // Use machine-specific data as encryption key
  const machineId = require('node-machine-id').machineIdSync();
  return crypto.createHash('sha256').update(machineId).digest();
}

private encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

private decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async saveCookies(cookies: Cookie[]): Promise<void> {
  this.logger.log('Saving cookies to disk', 'AuthService');
  
  try {
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Ensure directory exists
    await fs.mkdir(this.COOKIE_DIR, { recursive: true });
    
    // Encrypt and save to file
    const encrypted = this.encrypt(cookieHeader);
    await fs.writeFile(this.COOKIE_FILE, encrypted, 'utf8');
    
    // Also keep in process.env for current session
    process.env.LUMENTUI_COOKIES = cookieHeader;
    
    this.logger.log('Cookies saved successfully', 'AuthService');
  } catch (error) {
    this.logger.error('Failed to save cookies', error.stack, 'AuthService');
    throw new AuthException('Failed to save cookies');
  }
}

async loadCookies(): Promise<string> {
  this.logger.log('Loading cookies from disk', 'AuthService');
  
  try {
    // Try process.env first (current session)
    let cookieHeader = process.env.LUMENTUI_COOKIES;
    
    if (!cookieHeader) {
      // Read from file
      const encrypted = await fs.readFile(this.COOKIE_FILE, 'utf8');
      cookieHeader = this.decrypt(encrypted);
      
      // Cache in process.env
      process.env.LUMENTUI_COOKIES = cookieHeader;
    }
    
    if (!cookieHeader) {
      throw new AuthException('No cookies found. Please run: lumentui auth');
    }
    
    this.logger.log('Cookies loaded successfully', 'AuthService');
    return cookieHeader;
  } catch (error) {
    if (error instanceof AuthException) throw error;
    
    this.logger.error('Failed to load cookies', error.stack, 'AuthService');
    throw new AuthException('No cookies found. Please run: lumentui auth');
  }
}
```

**Dependencies requeridas:**
```bash
npm install --save node-machine-id
npm install --save-dev @types/node
```

**Opción B: OS Keychain (más segura, más compleja)**

```typescript
// Requiere: npm install keytar
import * as keytar from 'keytar';

private readonly SERVICE_NAME = 'lumentui';
private readonly ACCOUNT_NAME = 'cookies';

async saveCookies(cookies: Cookie[]): Promise<void> {
  try {
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, cookieHeader);
    process.env.LUMENTUI_COOKIES = cookieHeader;
    this.logger.log('Cookies saved to keychain', 'AuthService');
  } catch (error) {
    throw new AuthException('Failed to save cookies to keychain');
  }
}

async loadCookies(): Promise<string> {
  try {
    let cookieHeader = process.env.LUMENTUI_COOKIES;
    
    if (!cookieHeader) {
      cookieHeader = await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
      if (cookieHeader) {
        process.env.LUMENTUI_COOKIES = cookieHeader;
      }
    }
    
    if (!cookieHeader) {
      throw new AuthException('No cookies found. Please run: lumentui auth');
    }
    
    return cookieHeader;
  } catch (error) {
    throw new AuthException('No cookies found. Please run: lumentui auth');
  }
}
```

**Recomendación:** Opción A (file-based) es suficiente para v1. Opción B para v2 si hay requisitos de compliance.

---

### [ ] 3. Unificar error handling

```typescript
// auth.service.ts

async extractCookies(url: string): Promise<Cookie[]> {
  this.logger.log(`Extracting cookies for ${url}`, 'AuthService');
  
  try {
    const cookies = await new Promise<Cookie[]>((resolve, reject) => {
      chrome.getCookies(url, 'puppeteer', (err: Error | null, cookies: Cookie[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(cookies || []);
        }
      });
    });
    
    const digestCookie = cookies.find(c => c.name === 'storefront_digest');
    
    if (!digestCookie) {
      throw new AuthException(
        'storefront_digest cookie not found. Please log in to shop.lumenalta.com in Chrome.'
      );
    }
    
    this.logger.log('Cookie extracted successfully', 'AuthService');
    return [digestCookie];
    
  } catch (error) {
    this.logger.error('Failed to extract cookies', error.stack, 'AuthService');
    
    // Wrap native errors in AuthException
    if (error instanceof AuthException) {
      throw error;
    }
    
    // Detect Keychain errors
    if (error.message?.includes('Keychain') || error.message?.includes('access denied')) {
      throw new AuthException(
        'macOS Keychain access denied. Please grant permission when prompted.'
      );
    }
    
    throw new AuthException(`Failed to extract cookies: ${error.message}`);
  }
}
```

---

## 🟡 PRIORIDAD MEDIA (post-Fase 3)

### [ ] 4. Eliminar `as any` de tests

```typescript
// auth.service.spec.ts

describe('saveCookies', () => {
  it('should handle save errors', async () => {
    // ❌ ANTES
    await expect(service.saveCookies(null as any)).rejects.toThrow(AuthException);
    
    // ✅ DESPUÉS
    const invalidCookies = [
      {
        name: 'test',
        value: 'test',
        domain: 'example.com',
        path: '/',
      }
    ];
    
    // Force error by mocking fs.writeFile to throw
    jest.spyOn(fs, 'writeFile').mockRejectedValue(new Error('EACCES'));
    
    await expect(service.saveCookies(invalidCookies)).rejects.toThrow(AuthException);
  });
});
```

---

### [ ] 5. Agregar CLI E2E tests

```typescript
// test/cli.e2e.spec.ts

describe('CLI (E2E)', () => {
  it('should authenticate and save cookies', async () => {
    const { stdout, exitCode } = await execAsync('node dist/cli.js auth');
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain('✅ Authentication successful');
  });
  
  it('should check existing session', async () => {
    // First authenticate
    await execAsync('node dist/cli.js auth');
    
    // Then check
    const { stdout, exitCode } = await execAsync('node dist/cli.js auth --check');
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain('✅ Session is valid');
  });
});
```

---

### [ ] 6. Implementar cookie auto-refresh

```typescript
// auth.service.ts

async ensureValidCookies(): Promise<string> {
  try {
    const cookies = await this.loadCookies();
    const isValid = await this.validateCookies();
    
    if (!isValid) {
      this.logger.warn('Cookies expired, attempting refresh', 'AuthService');
      
      // Extract fresh cookies from Chrome
      const freshCookies = await this.extractCookies('https://shop.lumenalta.com');
      await this.saveCookies(freshCookies);
      
      return this.loadCookies();
    }
    
    return cookies;
  } catch (error) {
    throw new AuthException('Please run: lumentui auth');
  }
}
```

---

## 🟢 PRIORIDAD BAJA (nice-to-have)

### [ ] 7. Extraer magic strings

```typescript
// auth.constants.ts

export const AUTH_CONSTANTS = {
  REQUIRED_COOKIE_NAME: 'storefront_digest',
  SHOP_URL: 'https://shop.lumenalta.com',
  ENV_VAR_NAME: 'LUMENTUI_COOKIES',
} as const;
```

---

### [ ] 8. Agregar retry logic

```typescript
async extractCookies(url: string, maxRetries = 3): Promise<Cookie[]> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.extractCookiesOnce(url);
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        this.logger.warn(`Retry ${attempt}/${maxRetries}`, 'AuthService');
        await this.delay(1000 * attempt); // exponential backoff
      }
    }
  }
  
  throw lastError;
}
```

---

### [ ] 9. Agregar métricas

```typescript
// Track cookie usage and expiration patterns

async loadCookies(): Promise<string> {
  const cookies = await this.loadCookiesInternal();
  
  this.metrics.increment('auth.cookies.loaded');
  this.metrics.gauge('auth.cookies.age', this.getCookieAge());
  
  return cookies;
}
```

---

## 📊 Progreso

- [ ] **ALTA**: 0/3 completados
- [ ] **MEDIA**: 0/3 completados  
- [ ] **BAJA**: 0/3 completados

**Total:** 0/9 action items

---

## 🚀 Plan de Ejecución Sugerido

### Sprint 1 (antes de Fase 3)
```bash
# Día 1: Fix dead code
git checkout -b fix/auth-cookie-expiration
# Implementar Opción A o B del item #1
npm test
git commit -m "feat(auth): implement cookie expiration validation"

# Día 2: Persistence
# Implementar item #2 (file-based)
npm test
git commit -m "feat(auth): add durable cookie persistence"

# Día 3: Error handling
# Implementar item #3
npm test
git commit -m "fix(auth): unify error handling with AuthException"

git push origin fix/auth-cookie-expiration
# Create PR
```

### Sprint 2 (post-Fase 3)
- Items #4, #5, #6

### Backlog
- Items #7, #8, #9

---

**Nota:** Todos los items están listos para implementar. Solo requieren decisión de cuál opción elegir (A vs B) en items con múltiples opciones.
