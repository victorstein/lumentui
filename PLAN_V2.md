# 🌟 LumenTUI - Plan V2 (NestJS + macOS)

*el nido del vigilante - rediseñado con elegancia*

## 🎯 Objetivo

TUI para monitorear nuevos productos en https://shop.lumenalta.com con:
- **NestJS** como core (DI, modules, structure)
- **Ink** para TUI frontend (React)
- **Commander** para CLI commands
- **macOS Keychain** para cookies (no browser automation)
- Daemon en background polling cada minuto
- Notificaciones + listado hermoso
- **macOS only**

---

## 🏗️ Arquitectura Nueva

```
┌──────────────────────────────────────────────────┐
│          CLI Entry (Commander)                   │
│                                                   │
│  lumentui auth   → AuthService.extractCookies()  │
│  lumentui start  → DaemonService.start() + TUI   │
│  lumentui stop   → DaemonService.stop()          │
│  lumentui status → DaemonService.getStatus()     │
│                                                   │
└────────────┬─────────────────────────────────────┘
             │
             │
┌────────────┴─────────────────────────────────────┐
│       NestJS Daemon (Background Process)         │
├──────────────────────────────────────────────────┤
│                                                   │
│  AppModule                                        │
│  ├── AuthModule                                  │
│  │   └── AuthService (chrome-cookies-secure)    │
│  ├── ApiModule                                   │
│  │   └── ShopifyService (@nestjs/axios)         │
│  ├── StorageModule                               │
│  │   └── DatabaseService (better-sqlite3)       │
│  ├── PollerModule                                │
│  │   └── PollerService (@nestjs/schedule)       │
│  ├── NotificationModule                          │
│  │   └── NotificationService (node-notifier)    │
│  └── IpcModule                                   │
│      └── IpcGateway (Unix socket server)        │
│                                                   │
└────────────┬─────────────────────────────────────┘
             │ IPC (Unix Socket)
             │
┌────────────┴─────────────────────────────────────┐
│           Ink TUI (React Frontend)               │
├──────────────────────────────────────────────────┤
│                                                   │
│  <App>                                           │
│  ├── useDaemon() hook (IPC client)              │
│  ├── <Header>                                    │
│  ├── <ProductList>                               │
│  ├── <ProductDetail>                             │
│  ├── <LogPanel>                                  │
│  └── <StatusBar>                                 │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto (NestJS)

```
lumentui/
├── package.json
├── tsconfig.json
├── nest-cli.json                # NestJS config
├── .gitignore
├── .env.example
│
├── src/
│   ├── main.ts                  # NestJS bootstrap (daemon)
│   ├── cli.ts                   # Commander entry point
│   │
│   ├── modules/
│   │   ├── app/
│   │   │   ├── app.module.ts
│   │   │   └── app.service.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts       # chrome-cookies-secure
│   │   │   └── dto/
│   │   │       └── cookie.dto.ts
│   │   │
│   │   ├── api/
│   │   │   ├── api.module.ts
│   │   │   ├── shopify.service.ts    # HTTP client
│   │   │   └── interfaces/
│   │   │       └── shopify.interface.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── storage.module.ts
│   │   │   ├── database.service.ts   # SQLite
│   │   │   ├── entities/
│   │   │   │   ├── product.entity.ts
│   │   │   │   ├── poll.entity.ts
│   │   │   │   └── notification.entity.ts
│   │   │   └── migrations/
│   │   │       └── initial.migration.ts
│   │   │
│   │   ├── poller/
│   │   │   ├── poller.module.ts
│   │   │   ├── poller.service.ts     # @nestjs/schedule
│   │   │   └── differ.service.ts
│   │   │
│   │   ├── notification/
│   │   │   ├── notification.module.ts
│   │   │   └── notification.service.ts
│   │   │
│   │   └── ipc/
│   │       ├── ipc.module.ts
│   │       └── ipc.gateway.ts        # Unix socket server
│   │
│   ├── ui/                           # Ink TUI
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── ProductList.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── LogPanel.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── NotificationBanner.tsx
│   │   ├── hooks/
│   │   │   ├── useDaemon.ts
│   │   │   └── useProducts.ts
│   │   └── theme.ts
│   │
│   └── common/
│       ├── decorators/
│       ├── filters/
│       ├── guards/
│       ├── interceptors/
│       ├── pipes/
│       └── types/
│
├── data/                         # Runtime data (gitignored)
│   ├── lumentui.db
│   └── daemon.pid
│
└── docs/
```

---

## 🔐 Auth Flow (macOS Keychain)

### Estrategia: Chrome Cookies Extraction

```typescript
// src/modules/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import chrome from 'chrome-cookies-secure';

@Injectable()
export class AuthService {
  async extractCookies(url: string): Promise<CookieDto[]> {
    return new Promise((resolve, reject) => {
      chrome.getCookies(url, 'object', (err, cookies) => {
        if (err) {
          reject(new Error(`Failed to extract cookies: ${err.message}`));
        }
        
        // Filter for storefront_digest
        const authCookie = cookies['storefront_digest'];
        
        if (!authCookie) {
          reject(new Error('storefront_digest cookie not found'));
        }
        
        resolve([{
          name: 'storefront_digest',
          value: authCookie,
          domain: '.lumenalta.com'
        }]);
      });
    });
  }
  
  async saveCookies(cookies: CookieDto[]): Promise<void> {
    // Save to storage (encrypted, pero ya no necesario - Keychain lo maneja)
    const configService = this.configService;
    await configService.set('cookies', JSON.stringify(cookies));
  }
  
  async loadCookies(): Promise<string> {
    // O extraer fresh cada vez del Keychain
    const cookies = await this.extractCookies('https://shop.lumenalta.com');
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
}
```

### Comando Auth

```bash
lumentui auth
```

**Flow:**
1. Prompt: "Asegúrate de tener sesión activa en Chrome (shop.lumenalta.com)"
2. Pide permisos de Keychain (primera vez) → popup sistema
3. Extrae `storefront_digest` de Chrome cookies
4. Valida con request de prueba: `GET /products.json`
5. ✅ "Auth successful" o ❌ error

---

## 🔄 NestJS Daemon

### Main Bootstrap

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug']
  });
  
  // No HTTP server - solo services
  await app.init();
  
  const logger = new Logger('Bootstrap');
  logger.log('LumenTUI Daemon started');
  
  // Keep alive
  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully');
    await app.close();
  });
}

bootstrap();
```

### App Module

```typescript
// src/modules/app/app.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ApiModule } from '../api/api.module';
import { StorageModule } from '../storage/storage.module';
import { PollerModule } from '../poller/poller.module';
import { NotificationModule } from '../notification/notification.module';
import { IpcModule } from '../ipc/ipc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    ApiModule,
    StorageModule,
    PollerModule,
    NotificationModule,
    IpcModule
  ]
})
export class AppModule {}
```

---

## 📡 Shopify API Module (NestJS HttpService)

```typescript
// src/modules/api/api.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShopifyService } from './shopify.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5
    }),
    AuthModule
  ],
  providers: [ShopifyService],
  exports: [ShopifyService]
})
export class ApiModule {}
```

```typescript
// src/modules/api/shopify.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AuthService } from '../auth/auth.service';
import { firstValueFrom } from 'rxjs';
import { ShopifyProduct } from './interfaces/shopify.interface';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly baseUrl = 'https://shop.lumenalta.com';
  
  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService
  ) {}
  
  async getProducts(): Promise<ShopifyProduct[]> {
    const cookieHeader = await this.authService.loadCookies();
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/products.json`, {
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'LumenTUI/0.1.0',
            'Accept': 'application/json'
          }
        })
      );
      
      this.logger.debug(`Fetched ${response.data.products.length} products`);
      return response.data.products;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication expired. Run: lumentui auth');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Rate limited. Slowing down...');
      }
      
      throw error;
    }
  }
}
```

---

## 🔄 Poller Module (Scheduled Task)

```typescript
// src/modules/poller/poller.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShopifyService } from '../api/shopify.service';
import { DatabaseService } from '../storage/database.service';
import { DifferService } from './differ.service';
import { NotificationService } from '../notification/notification.service';
import { IpcGateway } from '../ipc/ipc.gateway';

@Injectable()
export class PollerService {
  private readonly logger = new Logger(PollerService.name);
  
  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly databaseService: DatabaseService,
    private readonly differService: DifferService,
    private readonly notificationService: NotificationService,
    private readonly ipcGateway: IpcGateway
  ) {}
  
  @Cron(CronExpression.EVERY_MINUTE)
  async pollProducts() {
    const startTime = Date.now();
    this.logger.debug('Starting poll...');
    
    try {
      // Fetch from API
      const products = await this.shopifyService.getProducts();
      
      // Compare with DB
      const diff = await this.differService.compare(products);
      
      // Notify new products
      for (const newProduct of diff.newProducts) {
        await this.notificationService.notify(newProduct);
        this.ipcGateway.emitProductNew(newProduct);
      }
      
      // Update DB
      await this.databaseService.saveProducts(products);
      
      // Record poll
      const duration = Date.now() - startTime;
      await this.databaseService.recordPoll({
        timestamp: Date.now(),
        product_count: products.length,
        new_products: diff.newProducts.length,
        duration_ms: duration,
        success: true
      });
      
      // Emit to TUI
      this.ipcGateway.emitHeartbeat(Date.now());
      this.ipcGateway.emitProductsUpdated(products);
      
      this.logger.log(`Poll completed: ${products.length} products, ${diff.newProducts.length} new`);
    } catch (error) {
      this.logger.error(`Poll failed: ${error.message}`, error.stack);
      
      await this.databaseService.recordPoll({
        timestamp: Date.now(),
        product_count: 0,
        new_products: 0,
        duration_ms: Date.now() - startTime,
        success: false,
        error: error.message
      });
      
      this.ipcGateway.emitError(error.message);
    }
  }
  
  async forcePoll() {
    this.logger.log('Force poll triggered');
    await this.pollProducts();
  }
}
```

---

## 🔌 IPC Module (Unix Socket)

```typescript
// src/modules/ipc/ipc.gateway.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as ipc from 'node-ipc';

@Injectable()
export class IpcGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpcGateway.name);
  
  onModuleInit() {
    ipc.config.id = 'lumentui-daemon';
    ipc.config.retry = 1500;
    ipc.config.silent = false;
    
    ipc.serve('/tmp/lumentui.sock', () => {
      ipc.server.on('connect', (socket) => {
        this.logger.log('TUI client connected');
      });
      
      ipc.server.on('disconnect', (socket) => {
        this.logger.log('TUI client disconnected');
      });
      
      ipc.server.on('force-poll', async (data, socket) => {
        this.logger.log('Force poll requested');
        // Inject PollerService aquí o emit event
      });
    });
    
    ipc.server.start();
    this.logger.log('IPC server started at /tmp/lumentui.sock');
  }
  
  onModuleDestroy() {
    ipc.server.stop();
    this.logger.log('IPC server stopped');
  }
  
  emitHeartbeat(timestamp: number) {
    ipc.server.broadcast('daemon:heartbeat', timestamp);
  }
  
  emitProductsUpdated(products: any[]) {
    ipc.server.broadcast('products:updated', products);
  }
  
  emitProductNew(product: any) {
    ipc.server.broadcast('product:new', product);
  }
  
  emitError(error: string) {
    ipc.server.broadcast('daemon:error', error);
  }
  
  emitLog(level: string, message: string) {
    ipc.server.broadcast('log', { level, message, timestamp: Date.now() });
  }
}
```

---

## 🎨 CLI Commands (Commander)

```typescript
// src/cli.ts
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { spawn } from 'child_process';
import { render } from 'ink';
import React from 'react';
import App from './ui/App';
import { AppModule } from './modules/app/app.module';
import { AuthService } from './modules/auth/auth.service';
import ora from 'ora';
import fs from 'fs';

const program = new Command();

program
  .name('lumentui')
  .description('🌟 Monitor shop.lumenalta.com for new products')
  .version('0.1.0');

// lumentui auth
program
  .command('auth')
  .description('Extract cookies from Chrome keychain')
  .action(async () => {
    const spinner = ora('Extracting cookies from Chrome...').start();
    
    try {
      const app = await NestFactory.createApplicationContext(AppModule);
      const authService = app.get(AuthService);
      
      const cookies = await authService.extractCookies('https://shop.lumenalta.com');
      await authService.saveCookies(cookies);
      
      // Validate
      const shopifyService = app.get(ShopifyService);
      await shopifyService.getProducts();
      
      spinner.succeed('✅ Authentication successful!');
      await app.close();
    } catch (error) {
      spinner.fail(`❌ Auth failed: ${error.message}`);
      process.exit(1);
    }
  });

// lumentui start
program
  .command('start')
  .description('Start daemon + TUI')
  .option('--daemon-only', 'Start only daemon (no TUI)')
  .action(async (options) => {
    // Fork daemon process
    const daemon = spawn('node', ['dist/main.js'], {
      detached: true,
      stdio: options.daemonOnly ? 'ignore' : 'pipe'
    });
    
    daemon.unref();
    fs.writeFileSync('data/daemon.pid', daemon.pid.toString());
    
    console.log(`Daemon started (PID: ${daemon.pid})`);
    
    if (!options.daemonOnly) {
      // Wait for IPC ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Launch TUI
      render(<App />);
    }
  });

// lumentui stop
program
  .command('stop')
  .description('Stop daemon')
  .action(() => {
    const pid = fs.readFileSync('data/daemon.pid', 'utf-8');
    process.kill(parseInt(pid), 'SIGTERM');
    fs.unlinkSync('data/daemon.pid');
    console.log('✅ Daemon stopped');
  });

// lumentui status
program
  .command('status')
  .description('Check daemon status')
  .action(() => {
    // Check PID + IPC connection
  });

program.parse();
```

---

## 🛠️ Tech Stack (Actualizado)

### Core
- **TypeScript** 5.x
- **Node.js** 22.x (ESM)
- **NestJS** ^10 - Framework backend (DI, modules)
  - `@nestjs/common`
  - `@nestjs/core`
  - `@nestjs/config`
  - `@nestjs/schedule` - Cron jobs
  - `@nestjs/axios` - HTTP client

### CLI & TUI
- **Commander** ^12 - CLI framework
- **Ink** ^5 - React terminal renderer
- **React** ^18

### Auth (macOS)
- **chrome-cookies-secure** ^1.3 - Extract cookies from Chrome
- **keytar** ^7.9 - Keychain access (dependency de chrome-cookies)

### HTTP & API
- **axios** (via @nestjs/axios)

### Storage
- **better-sqlite3** ^11 - SQLite

### Daemon
- **node-ipc** ^10 - Unix socket IPC

### Utilities
- **winston** ^3 - Logging (NestJS logger)
- **node-notifier** ^10 - OS notifications
- **date-fns** ^4
- **zod** ^3 - Validation
- **ora** ^8 - CLI spinners

### Dev
- **tsx** ^4
- **@nestjs/cli** ^10
- **vitest** ^2
- **eslint** + **prettier**

---

## 📦 package.json (Actualizado)

```json
{
  "name": "lumentui",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/cli.ts",
    "dev:daemon": "nest start --watch",
    "build": "nest build && tsup src/cli.ts --format esm",
    "start": "node dist/cli.js",
    "start:daemon": "node dist/main.js",
    "test": "vitest"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/schedule": "^4.1.1",
    "@nestjs/axios": "^3.1.2",
    "axios": "^1.7.9",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    
    "ink": "^5.0.1",
    "react": "^18.3.1",
    "commander": "^12.1.0",
    "chrome-cookies-secure": "^1.3.2",
    "keytar": "^7.9.0",
    "better-sqlite3": "^11.7.0",
    "node-ipc": "^10.1.0",
    "winston": "^3.17.0",
    "node-notifier": "^10.0.1",
    "date-fns": "^4.1.0",
    "ora": "^8.1.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.10",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.15",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "typescript": "^5.7.2",
    "tsx": "^4.19.2",
    "tsup": "^8.3.5",
    "vitest": "^2.1.8"
  }
}
```

---

## 🚀 Roadmap Actualizado

### Fase 1: Setup NestJS (Día 1-2)
- [ ] Init NestJS project: `nest new lumentui`
- [ ] Setup Commander CLI
- [ ] Configure modules structure
- [ ] Logger con Winston
- [ ] ConfigModule con .env

### Fase 2: Auth Module (Día 3)
- [ ] AuthModule + AuthService
- [ ] Integrar chrome-cookies-secure
- [ ] Extract cookies de Chrome Keychain
- [ ] CLI: `lumentui auth` command
- [ ] Validation + error handling

### Fase 3: API Module (Día 4)
- [ ] ApiModule con @nestjs/axios
- [ ] ShopifyService
- [ ] HTTP client con cookies
- [ ] Error handling (401, 429)
- [ ] Type definitions

### Fase 4: Storage Module (Día 5)
- [ ] StorageModule + DatabaseService
- [ ] SQLite setup con better-sqlite3
- [ ] Entities (Product, Poll, Notification)
- [ ] CRUD operations
- [ ] Migrations

### Fase 5: Poller Module (Día 6-7)
- [ ] PollerModule con @nestjs/schedule
- [ ] PollerService (cron each minute)
- [ ] DifferService (compare products)
- [ ] Integration con Storage + API
- [ ] Record metrics

### Fase 6: IPC Module (Día 8)
- [ ] IpcModule + IpcGateway
- [ ] Unix socket server (node-ipc)
- [ ] Events: heartbeat, products:updated, product:new, error, log
- [ ] Listen: force-poll

### Fase 7: Notification Module (Día 9)
- [ ] NotificationModule + NotificationService
- [ ] node-notifier integration
- [ ] Config-based filters

### Fase 8: TUI (Día 10-12)
- [ ] Ink App component
- [ ] useDaemon hook (IPC client)
- [ ] Components (Header, List, Detail, Logs)
- [ ] Theme + navigation

### Fase 9: CLI Integration (Día 13)
- [ ] Integrar todos los comandos
- [ ] Daemon fork logic
- [ ] PID management
- [ ] Testing end-to-end

### Fase 10: Polish & Deploy (Día 14-15)
- [ ] Testing
- [ ] Docs
- [ ] Build pipeline
- [ ] npm publish

---

## 🎯 Ventajas NestJS

1. **Dependency Injection** - Servicios testables e inyectables
2. **Modular** - Código organizado por feature
3. **Scheduling built-in** - Cron jobs nativos
4. **HTTP module** - Axios integrado con interceptors
5. **Testing utilities** - Test utilities de NestJS
6. **Decorators** - Clean syntax (@Injectable, @Cron)
7. **Lifecycle hooks** - OnModuleInit, OnModuleDestroy

---

## 🔐 macOS Keychain Flow

```
User abre Chrome → shop.lumenalta.com
          ↓
Ingresa password de Shopify
          ↓
Chrome guarda cookie en Keychain
          ↓
Usuario corre: lumentui auth
          ↓
chrome-cookies-secure extrae cookie
          ↓
macOS pide permiso (primera vez)
          ↓
Cookie disponible para daemon
```

**Primera vez:**
- Popup de macOS: "lumentui wants to access Chrome Keychain"
- Usuario permite
- No se vuelve a pedir

---

*el nuevo camino está trazado - más elegante y poderoso* 🥸

**Próximo paso:** ¿Empezamos con el código o revisamos algo más del plan?
