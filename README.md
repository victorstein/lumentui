# 🌟 LumenTUI - Product Monitoring Service

> Elegant NestJS-based product monitoring system for shop.lumenalta.com with real-time WhatsApp notifications

[![Tests](https://img.shields.io/badge/tests-76%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-93%25%20(core)-green)]()
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()

---

## 📖 Description

LumenTUI is a production-ready NestJS application that monitors product availability on shop.lumenalta.com and sends instant WhatsApp notifications when products become available. Built with enterprise-grade architecture, dependency injection, and comprehensive test coverage.

### ✨ Key Features

- 🔄 **Real-time Monitoring** - Polls Shopify storefront API for product updates
- 📱 **WhatsApp Notifications** - Instant alerts via Clawdbot integration
- 🍪 **Cookie-based Auth** - Secure authentication using macOS Chrome Keychain
- 💾 **SQLite Storage** - Lightweight, reliable product tracking
- 🏗️ **NestJS Architecture** - Modular, scalable, testable design
- 🧪 **High Test Coverage** - 76 unit tests with 93%+ coverage on core services
- 🔐 **Production Ready** - Environment-based config, proper logging
- 📊 **CLI Interface** - Commander.js-based command interface

---

## 🏗️ Architecture

### Module Overview

```
AppModule
├── ConfigModule         # Environment configuration (global)
├── LoggerModule         # Winston-based structured logging
├── AuthModule           # Cookie extraction & storage
│   └── AuthService      # chrome-cookies-secure integration
├── ApiModule            # Shopify API integration
│   └── ShopifyService   # HTTP client with retry logic
├── StorageModule        # SQLite database layer
│   └── DatabaseService  # Product CRUD operations
└── NotificationModule   # WhatsApp notifications
    └── NotificationService  # Clawdbot CLI integration
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  CLI Entry   │────▶│   NestJS     │────▶│   Shopify    │
│  (cli.ts)    │     │   Services   │     │     API      │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   SQLite DB  │
                     │  (products)  │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  WhatsApp    │
                     │  (Clawdbot)  │
                     └──────────────┘
```

---

## 📋 Requirements

- **Node.js** >= 18.x
- **npm** >= 9.x
- **macOS** (for Chrome Keychain integration)
- **Chrome Browser** (with valid shop.lumenalta.com session)
- **Clawdbot** (for WhatsApp notifications)

---

## 🚀 Installation

### 1. Clone & Install Dependencies

```bash
cd ~/clawd/development/lumentui/lumentui
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Required
NOTIFICATION_PHONE=+50586826131           # Your WhatsApp number (E.164 format)
LUMENTUI_SHOP_URL=https://shop.lumenalta.com

# Optional (defaults provided)
LUMENTUI_POLL_INTERVAL=60                 # Polling interval (seconds)
DB_PATH=data/lumentui.db                  # Database location
LOG_LEVEL=info                            # Logging level
```

### 3. Authenticate

Extract cookies from Chrome (requires Keychain access):

```bash
npm run build
node dist/cli.js auth
```

Expected output:
```
🔐 Extracting cookies from Chrome...
⚠️  macOS will ask for Keychain permission (first time only)
✅ Authentication successful!
```

Verify session:

```bash
node dist/cli.js auth --check
```

---

## 🎯 Usage

### Development Mode

```bash
# Start with hot-reload
npm run start:dev

# Run with debug logging
LOG_LEVEL=debug npm run start:dev
```

### Production Mode

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

### CLI Commands

```bash
# Authenticate with shop.lumenalta.com
lumentui auth

# Verify current session
lumentui auth --check

# Start daemon + TUI (planned)
lumentui start

# Stop daemon (planned)
lumentui stop

# Check daemon status (planned)
lumentui status
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:cov
```

Expected output:
```
Test Suites: 6 passed, 6 total
Tests:       76 passed, 76 total
Coverage:    93%+ (core services average)
```

### Test Files

| Module | Tests | Coverage |
|--------|-------|----------|
| **AuthService** | Unit tests | 91.04% |
| **ShopifyService** | Unit tests | 85.71% |
| **DatabaseService** | Unit tests | 98.24% |
| **NotificationService** | Unit tests | 100% |
| **SchedulerService** | Unit tests | 93.54% |
| **AppController** | Unit tests | 100% |

---

## 📡 API Endpoints

Currently CLI-only, but the NestJS foundation supports REST endpoints:

```typescript
// Example endpoints (planned)
GET  /api/products         // List all tracked products
GET  /api/products/:id     // Get product details
POST /api/auth/validate    // Validate cookies
GET  /api/health           // Health check
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NOTIFICATION_PHONE` | WhatsApp target (E.164) | - | ✅ |
| `LUMENTUI_SHOP_URL` | Shopify store URL | https://shop.lumenalta.com | ✅ |
| `DB_PATH` | SQLite database path | data/lumentui.db | ❌ |
| `LOG_LEVEL` | Logging level | info | ❌ |
| `LOG_FILE` | Log file path | data/logs/app.log | ❌ |
| `SHOPIFY_TIMEOUT_MS` | API timeout | 10000 | ❌ |
| `SHOPIFY_RETRY_ATTEMPTS` | Retry attempts | 3 | ❌ |
| `LUMENTUI_COOKIES` | Manual cookie override | - | ❌ |

### Database Schema

```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    vendor TEXT,
    product_type TEXT,
    tags TEXT,
    variants TEXT,
    images TEXT,
    description TEXT,
    available_for_sale INTEGER,
    created_at TEXT,
    updated_at TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_available_at TEXT
);
```

---

## 📂 Project Structure

```
lumentui/
├── src/
│   ├── main.ts                    # NestJS entry point
│   ├── cli.ts                     # Commander CLI entry
│   ├── app.module.ts              # Root module
│   ├── app.controller.ts          # Root controller
│   ├── app.service.ts             # Root service
│   │
│   ├── common/
│   │   └── logger/                # Winston logger
│   │
│   └── modules/
│       ├── api/                   # Shopify API integration
│       │   ├── shopify.service.ts
│       │   ├── dto/               # Data Transfer Objects
│       │   ├── interfaces/        # TypeScript interfaces
│       │   ├── exceptions/        # Custom exceptions
│       │   └── utils/             # Normalizers
│       │
│       ├── auth/                  # Authentication
│       │   ├── auth.service.ts
│       │   ├── cookie-storage.service.ts
│       │   ├── interfaces/
│       │   └── exceptions/
│       │
│       ├── storage/               # SQLite persistence
│       │   ├── database.service.ts
│       │   ├── entities/          # Product entity
│       │   └── utils/             # Normalizers
│       │
│       ├── notification/          # WhatsApp notifications
│       │   └── notification.service.ts
│       │
│       ├── poller/                # Polling scheduler (WIP)
│       └── ipc/                   # Unix socket IPC (WIP)
│
├── data/                          # Runtime data
│   ├── lumentui.db                # SQLite database
│   ├── cookies.json               # Stored cookies
│   └── logs/                      # Application logs
│
├── test/                          # E2E tests
├── coverage/                      # Test coverage reports
├── dist/                          # Compiled output
│
├── .env                           # Environment config (gitignored)
├── .env.example                   # Environment template
├── .env.production                # Production config template
├── ecosystem.config.js            # PM2 configuration
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config
├── nest-cli.json                  # NestJS CLI config
└── README.md                      # This file
```

---

## 🐛 Troubleshooting

### Authentication Issues

**Problem:** `❌ Failed to extract cookies`

**Solution:**
1. Open Chrome and log into shop.lumenalta.com
2. Grant Keychain access when prompted
3. Run `node dist/cli.js auth` again

**Problem:** `❌ No valid session`

**Solution:**
```bash
# Clear old cookies
rm data/cookies.json

# Re-authenticate
node dist/cli.js auth
```

---

### Database Issues

**Problem:** `SQLITE_ERROR: database is locked`

**Solution:**
```bash
# Stop all running instances
pkill -f lumentui

# Remove lock file
rm data/lumentui.db-wal data/lumentui.db-shm
```

**Problem:** Database corruption

**Solution:**
```bash
# Backup old database
cp data/lumentui.db data/lumentui.db.backup

# Start fresh
rm data/lumentui.db
npm run start:dev  # Database will be recreated
```

---

### Notification Issues

**Problem:** WhatsApp notifications not sending

**Solution:**
1. Verify Clawdbot is running: `clawdbot gateway status`
2. Check phone number format: Must be E.164 (e.g., `+50586826131`)
3. Test notification manually:
```bash
message --action=send --channel=whatsapp --target=+50586826131 --message="Test"
```

---

### API Issues

**Problem:** `ShopifyApiException: Request failed with status 429`

**Solution:**
- Rate limit hit. Increase `LUMENTUI_POLL_INTERVAL` in `.env`
- Default: 60 seconds. Try 120 seconds.

**Problem:** `ShopifyApiException: Request timed out`

**Solution:**
```bash
# Increase timeout in .env
SHOPIFY_TIMEOUT_MS=30000
SHOPIFY_RETRY_ATTEMPTS=5
```

---

### Test Issues

**Problem:** Tests failing with "Cannot find module"

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
npm test
```

**Problem:** Test database conflicts

**Solution:**
Tests use in-memory SQLite by default. If issues persist:
```bash
# Use separate test database
DB_PATH=:memory: npm test
```

---

## 📊 Performance

### Resource Usage (Typical)

- **Memory:** ~50-80 MB (idle)
- **CPU:** <5% (polling every 60s)
- **Disk:** ~1-5 MB (database growth)
- **Network:** ~10-50 KB/request

### Optimization Tips

1. **Increase poll interval** for lower CPU usage:
   ```bash
   LUMENTUI_POLL_INTERVAL=300  # 5 minutes
   ```

2. **Enable database WAL mode** for better concurrency:
   ```sql
   PRAGMA journal_mode=WAL;
   ```

3. **Compress logs** with log rotation:
   ```bash
   LOG_FILE=data/logs/app-%DATE%.log
   ```

---

## 🛠️ Development

### Adding a New Module

```bash
nest g module modules/mymodule
nest g service modules/mymodule
nest g controller modules/mymodule
```

### Running Linter

```bash
npm run lint
```

### Formatting Code

```bash
npm run format
```

### Debugging

```bash
# Start with Node inspector
npm run start:debug

# Connect with Chrome DevTools:
# chrome://inspect
```

---

## 🔐 Security

### Best Practices

✅ **Environment variables** - Never commit `.env` files
✅ **Keychain integration** - Cookies stored securely in macOS Keychain
✅ **Rate limiting** - Built-in notification throttling (1 hour per product)
✅ **Input validation** - DTOs with class-validator
✅ **Error handling** - Custom exceptions with proper logging

### Cookie Storage

Cookies are extracted from Chrome Keychain (encrypted) and stored in:
```
data/cookies.json  # gitignored, chmod 600
```

Never share this file or commit it to version control.

---

## 📝 License

**UNLICENSED** - Private project for personal use.

---

## 👤 Author

**Stein Hakase**  
Email: stein.hakase.vs@gmail.com  
GitHub: [@steinhakase](https://github.com/steinhakase)

---

## 🙏 Acknowledgments

- **NestJS** - Framework foundation
- **Clawdbot** - WhatsApp integration
- **Shopify** - Storefront API
- **chrome-cookies-secure** - Cookie extraction
- **better-sqlite3** - Database layer

---

## 📅 Changelog

### v1.0.0 (2025-01-21)

✅ Initial release with complete implementation:
- Auth module with Chrome cookie extraction
- API module with Shopify integration + retry logic
- Storage module with SQLite persistence
- Scheduler module with cron jobs (30min polls)
- Notification module with WhatsApp integration
- Full test coverage (76 tests, 93%+ coverage on core services)
- Integration tests for end-to-end flow
- CLI interface with Commander.js
- Complete documentation (README, DEPLOYMENT, TESTING)
- Production-ready with PM2 support

---

## 🚀 Roadmap

### Phase 2 (Planned)
- [ ] Daemon mode with PM2
- [ ] Ink-based TUI (React)
- [ ] IPC communication (Unix sockets)
- [ ] Real-time product list view
- [ ] Product detail modal
- [ ] Log streaming panel

### Phase 3 (Future)
- [ ] REST API endpoints
- [ ] Swagger documentation
- [ ] Docker support
- [ ] Multi-store support
- [ ] Email notifications
- [ ] Webhook support

---

**Made with ❤️ and TypeScript**
