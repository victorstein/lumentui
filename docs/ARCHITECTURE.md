# 🏗️ LumentuiAPI Architecture Documentation

Comprehensive architectural overview of the LumentuiAPI NestJS application.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Module Architecture](#module-architecture)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [IPC Communication](#ipc-communication)
6. [Service Interactions](#service-interactions)
7. [Error Handling Strategy](#error-handling-strategy)
8. [Security Architecture](#security-architecture)
9. [Scalability Considerations](#scalability-considerations)

---

## 🎯 System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (Commander.js - User Interface)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Application                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AppModule (Root)                         │  │
│  │  ┌──────────┬──────────┬──────────┬──────────────┐  │  │
│  │  │  Config  │  Logger  │  Auth    │  API         │  │  │
│  │  │  Module  │  Module  │  Module  │  Module      │  │  │
│  │  └──────────┴──────────┴──────────┴──────────────┘  │  │
│  │  ┌──────────┬──────────┬──────────┬──────────────┐  │  │
│  │  │ Storage  │Scheduler │  Notif   │  IPC         │  │  │
│  │  │  Module  │  Module  │  Module  │  Module      │  │  │
│  │  └──────────┴──────────┴──────────┴──────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ SQLite  │  │ Chrome  │  │Clawdbot │
   │   DB    │  │Keychain │  │  API    │
   └─────────┘  └─────────┘  └─────────┘
```

### Component Responsibilities

| Component              | Responsibility                        | Technology            |
| ---------------------- | ------------------------------------- | --------------------- |
| **CLI**                | User interface, command parsing       | Commander.js          |
| **AppModule**          | Root module, dependency injection     | NestJS                |
| **AuthModule**         | Cookie extraction, session management | chrome-cookies-secure |
| **ApiModule**          | Shopify API integration               | Axios, axios-retry    |
| **StorageModule**      | Data persistence                      | better-sqlite3        |
| **SchedulerModule**    | Periodic polling                      | @nestjs/schedule      |
| **NotificationModule** | WhatsApp messaging                    | Clawdbot CLI          |
| **IpcModule**          | Inter-process communication           | node-ipc              |
| **LoggerModule**       | Structured logging                    | Winston               |

---

## 🧩 Module Architecture

### 1. AppModule (Root)

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    AuthModule,
    ApiModule,
    StorageModule,
    SchedulerModule,
    NotificationModule,
    IpcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Purpose:** Bootstraps the application and wires all modules together.

---

### 2. AuthModule

**Location:** `src/modules/auth/`

**Purpose:** Handles authentication with shop.lumenalta.com via Chrome cookies.

#### Components

```
auth/
├── auth.module.ts
├── auth.service.ts                 # Main authentication logic
├── cookie-storage.service.ts       # Cookie persistence
├── interfaces/
│   ├── cookie.interface.ts         # Cookie data structure
│   └── session.interface.ts        # Session metadata
└── exceptions/
    └── auth.exception.ts           # Custom auth errors
```

#### Service API

```typescript
@Injectable()
export class AuthService {
  // Extract cookies from Chrome Keychain
  async extractCookies(url: string): Promise<Cookie[]>;

  // Save cookies to data/cookies.json
  async saveCookies(cookies: Cookie[]): Promise<void>;

  // Load cookies from storage
  async loadCookies(): Promise<Cookie[]>;

  // Validate current session
  async validateCookies(): Promise<boolean>;

  // Get cookie header string for API requests
  getCookieHeader(): string;
}
```

#### Data Flow

```
User
  │
  ├─> CLI: lumentui auth
  │
  └─> AuthService.extractCookies()
        │
        ├─> chrome-cookies-secure
        │     └─> macOS Keychain
        │           └─> Chrome Cookies
        │
        ├─> CookieStorageService.save()
        │     └─> data/cookies.json
        │
        └─> Return: Cookie[]
```

---

### 3. ApiModule (Shopify)

**Location:** `src/modules/api/shopify/`

**Purpose:** Interacts with shop.lumenalta.com Shopify Storefront API.

#### Components

```
api/shopify/
├── shopify.module.ts
├── shopify.service.ts              # API client
├── dto/
│   ├── product.dto.ts              # Product data transfer object
│   └── collection.dto.ts           # Collection DTO
├── interfaces/
│   ├── product.interface.ts        # Product type definition
│   └── api-response.interface.ts   # API response structure
├── exceptions/
│   └── shopify-api.exception.ts    # Custom API errors
└── utils/
    └── product-normalizer.util.ts  # Data transformation
```

#### Service API

```typescript
@Injectable()
export class ShopifyService {
  // Fetch all products from storefront
  async fetchProducts(): Promise<Product[]>;

  // Fetch product by handle
  async fetchProductByHandle(handle: string): Promise<Product>;

  // Check product availability
  async checkAvailability(handle: string): Promise<boolean>;

  // Get product variants
  async getVariants(productId: string): Promise<Variant[]>;
}
```

#### HTTP Client Configuration

```typescript
// Axios with retry logic
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429
    );
  },
});
```

#### Error Handling

| Error Type       | HTTP Status | Retry? | Action              |
| ---------------- | ----------- | ------ | ------------------- |
| Network Error    | -           | ✅     | Exponential backoff |
| 429 Rate Limit   | 429         | ✅     | Retry after delay   |
| 401 Unauthorized | 401         | ❌     | Re-authenticate     |
| 500 Server Error | 500         | ✅     | Retry 3 times       |
| 404 Not Found    | 404         | ❌     | Return empty        |

---

### 4. StorageModule

**Location:** `src/modules/storage/`

**Purpose:** SQLite-based persistence layer for products and metadata.

#### Components

```
storage/
├── storage.module.ts
├── database/
│   └── database.service.ts         # SQLite operations
├── entities/
│   └── product.entity.ts           # Product entity definition
└── utils/
    └── storage-normalizer.util.ts  # Data transformation
```

#### Service API

```typescript
@Injectable()
export class DatabaseService implements OnModuleInit {
  // Initialize database and create tables
  onModuleInit(): Promise<void>;

  // Save single product
  async saveProduct(product: Product): Promise<void>;

  // Save multiple products
  async saveProducts(products: Product[]): Promise<void>;

  // Get product by ID
  async getProduct(id: string): Promise<Product | null>;

  // Get product by handle
  async getProductByHandle(handle: string): Promise<Product | null>;

  // Get all products
  async getAllProducts(): Promise<Product[]>;

  // Update product availability
  async updateAvailability(id: string, available: boolean): Promise<void>;

  // Delete product
  async deleteProduct(id: string): Promise<void>;
}
```

#### Database Operations

```typescript
// Prepared statements for performance
private stmt = {
  insert: this.db.prepare(`
    INSERT OR REPLACE INTO products (...) VALUES (...)
  `),
  select: this.db.prepare(`
    SELECT * FROM products WHERE id = ?
  `),
  selectAll: this.db.prepare(`
    SELECT * FROM products ORDER BY last_seen_at DESC
  `),
  update: this.db.prepare(`
    UPDATE products SET available_for_sale = ?, last_available_at = ?
    WHERE id = ?
  `),
};
```

---

### 5. SchedulerModule

**Location:** `src/modules/scheduler/`

**Purpose:** Orchestrates periodic polling of Shopify API.

#### Components

```
scheduler/
├── scheduler.module.ts
└── scheduler.service.ts            # Cron job logic
```

#### Service API

```typescript
@Injectable()
export class SchedulerService {
  // Poll products every 30 minutes
  @Cron('*/30 * * * *')
  async pollProducts(): Promise<void>

  // Manual trigger for testing
  async triggerPoll(): Promise<void>

  // Get last poll timestamp
  getLastPollTime(): Date | null
}
```

#### Polling Flow

```
┌─────────────────┐
│  Cron Trigger   │
│  (Every 30min)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ShopifyService │
│  .fetchProducts │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Compare with   │
│  DB State       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 [New]    [Changed]
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Save to DB     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notify User    │
│  (WhatsApp)     │
└─────────────────┘
```

---

### 6. NotificationModule

**Location:** `src/modules/notification/`

**Purpose:** Sends WhatsApp notifications via Clawdbot.

#### Components

```
notification/
├── notification.module.ts
└── notification.service.ts         # WhatsApp integration
```

#### Service API

```typescript
@Injectable()
export class NotificationService {
  // Send product notification
  async notifyProductAvailable(product: Product): Promise<void>;

  // Send custom message
  async sendMessage(message: string): Promise<void>;

  // Check if product was recently notified
  private shouldNotify(productId: string): boolean;

  // Rate limiting: 1 notification per hour per product
  private lastNotified: Map<string, Date> = new Map();
}
```

#### Message Format

```typescript
const message = `
🔔 Product Available!

${product.title}
Price: $${product.price}
Link: ${product.url}

Available variants: ${variants.join(', ')}
`;
```

#### Clawdbot Integration

```bash
# CLI invocation
message \
  --action=send \
  --channel=whatsapp \
  --target=+50586826131 \
  --message="..."
```

---

### 7. IpcModule (Unix Socket)

**Location:** `src/modules/ipc/`

**Purpose:** Inter-process communication for CLI ↔ Daemon.

#### Components

```
ipc/
├── ipc.module.ts
├── ipc.gateway.ts                  # Socket server
└── ipc.client.ts                   # Socket client
```

#### Socket Protocol

```typescript
// Server (daemon)
@WebSocketGateway({
  namespace: '/lumentui',
  path: '/tmp/lumentui.sock',
})
export class IpcGateway {
  @SubscribeMessage('status')
  handleStatus(client: Socket, data: any): any {
    return { status: 'running', uptime: process.uptime() };
  }

  @SubscribeMessage('list')
  handleList(client: Socket): any {
    return this.databaseService.getAllProducts();
  }
}

// Client (CLI)
const socket = io('unix:///tmp/lumentui.sock');
socket.emit('status', {}, (response) => {
  console.log(response);
});
```

#### IPC Messages

| Message           | Direction    | Payload   | Response                       |
| ----------------- | ------------ | --------- | ------------------------------ |
| `status`          | CLI → Daemon | `{}`      | `{ status, uptime, lastPoll }` |
| `list`            | CLI → Daemon | `{}`      | `Product[]`                    |
| `start`           | CLI → Daemon | `{}`      | `{ success: true }`            |
| `stop`            | CLI → Daemon | `{}`      | `{ success: true }`            |
| `product:new`     | Daemon → TUI | `Product` | -                              |
| `product:updated` | Daemon → TUI | `Product` | -                              |

---

## 🔄 Data Flow

### Complete Product Monitoring Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Authentication                                      │
└─────────────────────────────────────────────────────────────┘
                         │
   User runs: lumentui auth
                         │
                         ▼
   AuthService.extractCookies() → Chrome Keychain
                         │
                         ▼
   Save to: data/cookies.json
                         │

┌─────────────────────────────────────────────────────────────┐
│  Step 2: Daemon Startup                                      │
└─────────────────────────────────────────────────────────────┘
                         │
   User runs: npm start:prod
                         │
                         ▼
   NestJS bootstrap → Load modules
                         │
                         ▼
   SchedulerService → Start cron job (30min)
                         │
                         ▼
   IpcGateway → Listen on /tmp/lumentui.sock
                         │

┌─────────────────────────────────────────────────────────────┐
│  Step 3: Polling Cycle (every 30 minutes)                   │
└─────────────────────────────────────────────────────────────┘
                         │
   Cron trigger → SchedulerService.pollProducts()
                         │
                         ▼
   ShopifyService.fetchProducts()
     │
     ├─> Load cookies from AuthService
     ├─> HTTP GET to Shopify API
     ├─> Retry logic (3 attempts)
     └─> Parse JSON response
                         │
                         ▼
   Normalize data → ProductDTO
                         │
                         ▼
   DatabaseService.saveProducts()
     │
     ├─> Compare with existing products
     ├─> Detect changes (new, availability)
     └─> INSERT OR REPLACE
                         │
                         ▼
   For each new/changed product:
     │
     ├─> NotificationService.notifyProductAvailable()
     │     │
     │     ├─> Check rate limit (1hr)
     │     ├─> Format message
     │     └─> Execute: message --action=send ...
     │
     └─> IpcGateway.emit('product:updated')
                         │

┌─────────────────────────────────────────────────────────────┐
│  Step 4: User Queries (via CLI)                             │
└─────────────────────────────────────────────────────────────┘
                         │
   User runs: lumentui status
                         │
                         ▼
   IPC Client → Connect to /tmp/lumentui.sock
                         │
                         ▼
   Send message: { type: 'status' }
                         │
                         ▼
   IpcGateway.handleStatus() → Return daemon state
                         │
                         ▼
   CLI displays: ✅ Daemon running, last poll: 5 min ago
```

---

## 🗄️ Database Schema

### Products Table

```sql
CREATE TABLE IF NOT EXISTS products (
  -- Primary keys
  id TEXT PRIMARY KEY NOT NULL,
  handle TEXT UNIQUE NOT NULL,

  -- Product data
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  tags TEXT,                    -- JSON string
  variants TEXT,                -- JSON string
  images TEXT,                  -- JSON string
  description TEXT,

  -- Availability
  available_for_sale INTEGER NOT NULL DEFAULT 0,  -- 0 or 1

  -- Timestamps
  created_at TEXT NOT NULL,     -- ISO8601
  updated_at TEXT NOT NULL,     -- ISO8601
  first_seen_at TEXT NOT NULL,  -- ISO8601
  last_seen_at TEXT NOT NULL,   -- ISO8601
  last_available_at TEXT        -- ISO8601 (NULL if never available)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_handle
  ON products(handle);

CREATE INDEX IF NOT EXISTS idx_products_available
  ON products(available_for_sale);

CREATE INDEX IF NOT EXISTS idx_products_last_seen
  ON products(last_seen_at DESC);
```

### Example Row

```json
{
  "id": "gid://shopify/Product/1234567890",
  "handle": "wireless-headphones",
  "title": "Premium Wireless Headphones",
  "vendor": "Lumenalta",
  "product_type": "Electronics",
  "tags": "[\"audio\", \"wireless\", \"premium\"]",
  "variants": "[{\"id\":\"...\",\"title\":\"Black\",\"price\":299.99}]",
  "images": "[{\"url\":\"https://...\",\"alt\":\"...\"}]",
  "description": "High-quality wireless headphones...",
  "available_for_sale": 1,
  "created_at": "2025-01-15T10:00:00.000Z",
  "updated_at": "2025-01-21T15:30:00.000Z",
  "first_seen_at": "2025-01-21T08:00:00.000Z",
  "last_seen_at": "2025-01-21T15:30:00.000Z",
  "last_available_at": "2025-01-21T14:00:00.000Z"
}
```

---

## 🔐 Security Architecture

### 1. Cookie Security

```
Chrome Keychain (encrypted)
         │
         ├─> macOS Keychain Access Prompt
         │
         ▼
AuthService.extractCookies()
         │
         ├─> Filter: shop.lumenalta.com only
         │
         ▼
data/cookies.json (chmod 600)
```

**Security measures:**

- Cookies never logged
- File permissions: 600 (owner read/write only)
- Not committed to git (.gitignore)
- Encrypted at rest by macOS

### 2. API Security

```typescript
// Rate limiting
const RATE_LIMIT = {
  requests: 100, // Max requests
  window: 3600000, // Per hour
};

// Timeout
const TIMEOUT = 10000; // 10 seconds

// Retry with backoff
const RETRY_CONFIG = {
  retries: 3,
  delay: (retryCount) => retryCount * 1000,
};
```

### 3. Database Security

- No sensitive data in database (cookies separate)
- File permissions: 644 (owner RW, group/others R)
- WAL mode for concurrency
- No SQL injection (prepared statements)

---

## 📊 Scalability Considerations

### Current Limitations

| Resource             | Limit          | Reason                   |
| -------------------- | -------------- | ------------------------ |
| **Products**         | ~10,000        | SQLite performance       |
| **Poll Frequency**   | 30 minutes     | Rate limiting            |
| **Concurrent Users** | 1              | Single daemon            |
| **Notifications**    | 1/hour/product | WhatsApp spam prevention |

### Scaling Strategies

#### 1. Horizontal Scaling

```
User 1 → Daemon Instance 1 → SQLite DB 1
User 2 → Daemon Instance 2 → SQLite DB 2
User 3 → Daemon Instance 3 → SQLite DB 3
```

#### 2. Database Migration

```
SQLite → PostgreSQL
  - Supports concurrent connections
  - Better performance at scale
  - JSONB for product data
```

#### 3. Queue-Based Architecture

```
Scheduler → RabbitMQ → Worker Pool → Database
                    └→ Worker Pool → Notifications
```

---

## 🎯 Future Architecture Enhancements

### Phase 2: TUI + Real-time

```
┌─────────────────┐
│   Ink TUI       │  ← WebSocket
│  (React UI)     │  ← Real-time updates
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  IPC Gateway    │
│  (Unix Socket)  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Daemon Core    │
│  (NestJS)       │
└─────────────────┘
```

### Phase 3: REST API

```
┌─────────────────┐
│  External App   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  REST API       │
│  (NestJS)       │
│  /api/products  │
│  /api/auth      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Core Services  │
└─────────────────┘
```

---

## 📚 References

- [NestJS Architecture](https://docs.nestjs.com/fundamentals/async-components)
- [Shopify Storefront API](https://shopify.dev/api/storefront)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)
- [Unix Socket IPC](https://man7.org/linux/man-pages/man7/unix.7.html)

---

**Architecture Version:** 1.0.0  
**Last Updated:** 2025-01-21  
**Maintainer:** Stein Hakase (stein.hakase.vs@gmail.com)
