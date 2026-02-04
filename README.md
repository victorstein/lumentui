# 🌟 LumenTUI - Product Monitoring Service

> Elegant NestJS-based product monitoring system for shop.lumenalta.com with real-time macOS notifications

[![Tests](https://img.shields.io/badge/tests-179%20passing-brightgreen)]()
[![Coverage](<https://img.shields.io/badge/coverage-93%25%20(core)-green>)]()
[![Version](https://img.shields.io/badge/version-1.2.3-blue)]()
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()

---

## 📖 Description

LumenTUI is a production-ready NestJS application that monitors product availability on shop.lumenalta.com and sends instant macOS notifications when products become available. Built with enterprise-grade architecture, dependency injection, and comprehensive test coverage.

### ✨ Key Features

- 🔄 **Real-time Monitoring** - Configurable polling of Shopify storefront API
- 📱 **macOS Notifications** - Instant native notification center alerts
- 🍪 **Cookie-based Auth** - Secure authentication using macOS Chrome Keychain
- 💾 **SQLite Storage** - Lightweight, reliable product tracking
- 🏗️ **NestJS Architecture** - Modular, scalable, testable design
- 🧪 **High Test Coverage** - 179 unit tests with 93%+ coverage on core services
- 🔐 **Production Ready** - Daemon mode, IPC layer, proper logging
- 📊 **Full CLI** - Complete command interface (login, start, stop, status, logs)
- 🌍 **Cross-platform** - Works on macOS, Linux, and Windows
- 📦 **Easy Distribution** - npm package and Homebrew tap

---

## 🏗️ Architecture

### Module Overview

```
AppModule
├── ConfigModule            # Environment configuration (global)
├── LoggerModule            # Winston-based structured logging
├── AuthModule              # Cookie extraction & storage
│   └── AuthService         # chrome-cookies-secure integration
├── ApiModule               # Shopify API integration
│   └── ShopifyService      # HTTP client with retry logic
├── StorageModule           # SQLite database layer
│   └── DatabaseService     # Product CRUD operations
├── SchedulerModule         # Polling scheduler
│   └── SchedulerService    # Configurable interval polling
├── IpcModule               # Inter-process communication
│   └── IpcGateway          # Unix socket/Named pipe server
├── DifferModule            # Change detection
│   └── DifferService       # Product comparison logic
└── NotificationModule      # macOS notifications
    └── NotificationService # Native notification center integration
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
                     │    macOS     │
                     │Notifications │
                     └──────────────┘
```

---

## 📋 Requirements

- **Node.js** >= 18.x
- **pnpm** >= 10.x (for development)
- **macOS** (for Chrome Keychain integration and native notifications)
- **Chrome Browser** (with valid shop.lumenalta.com session)

---

## 🚀 Installation

### Homebrew (Recommended)

```bash
brew tap victorstein/lumentui
brew install lumentui
```

### Package Manager

```bash
# Using pnpm (recommended)
pnpm install -g lumentui

# Or using npm
npm install -g lumentui
```

### From Source

```bash
git clone https://github.com/victorstein/lumentui.git
cd lumentui
pnpm install
pnpm run build
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Required
LUMENTUI_SHOP_URL=https://shop.lumenalta.com

# Optional (defaults provided)
LUMENTUI_POLL_INTERVAL=60                 # Polling interval (seconds)
DB_PATH=data/lumentui.db                  # Database location
LOG_LEVEL=info                            # Logging level
```

### 3. Authenticate

Extract cookies from Chrome (requires Keychain access):

```bash
lumentui login
```

Expected output:

```
🔐 Extracting cookies from Chrome...
⚠️  macOS will ask for Keychain permission (first time only)
✅ Authentication successful!
```

Verify session:

```bash
lumentui login --check
```

---

## 🎯 Usage

### Development Mode

```bash
# Start daemon with hot-reload
pnpm run dev

# Run with debug logging
LOG_LEVEL=debug pnpm run dev
```

### Production Mode

```bash
# Build for production
pnpm run build

# Start CLI
lumentui start
```

### CLI Commands

```bash
# Authenticate with shop.lumenalta.com
lumentui login

# Verify current session
lumentui login --check

# Start daemon + TUI
lumentui start

# Stop daemon
lumentui stop

# Check daemon status
lumentui status

# View daemon logs
lumentui logs

# Manage configuration
lumentui config

# Trigger manual poll
lumentui poll
```

---

## 🧪 Testing

### Run All Tests

```bash
pnpm test
```

### Watch Mode

```bash
pnpm run test:watch
```

### Coverage Report

```bash
pnpm run test:cov
```

Expected output:

```
Test Suites: 11 passed, 11 total
Tests:       179 passed, 179 total
Coverage:    93%+ (core services average)
```

### Test Coverage

All core services have comprehensive unit tests with 90%+ coverage:

- **AuthService** - Cookie extraction and storage
- **ShopifyService** - API integration with retry logic
- **DatabaseService** - SQLite operations and migrations
- **NotificationService** - macOS notification delivery
- **SchedulerService** - Polling and cron jobs
- **IpcGateway** - Unix socket communication
- **DifferService** - Product change detection
- **PathsUtil** - Cross-platform path resolution

---

## 🔔 Notification Types

LumenTUI notifies you about three types of product changes (all types are always enabled):

### 1. New Products

When a product appears in the store for the first time.

```
🔔 New Product Available
Gaming Mouse - $59.99
2 variants available
```

### 2. Price Changes

When a product's price increases or decreases.

```
🔔 Price Change
Premium Headphones
Price dropped from $199.99 to $149.99
```

**Configuration:**

- `LUMENTUI_NOTIFY_PRICE_THRESHOLD` - Minimum % change to trigger notification (default: `0`)
  - `0` = Any price change triggers notification
  - `10` = Only ≥10% changes trigger notification
  - Applies to both increases and decreases

**Example:** Set threshold to 10% to ignore minor price fluctuations:

```bash
LUMENTUI_NOTIFY_PRICE_THRESHOLD=10  # Only notify if price changes by 10% or more
```

### 3. Availability Changes

When a product goes out of stock or comes back in stock.

```
🔔 Availability Update
Gaming Keyboard is back in stock!
Price: $89.99
```

### Notification Filters

All notification types respect these filters:

| Filter                          | Description                                | Example                    |
| ------------------------------- | ------------------------------------------ | -------------------------- |
| `LUMENTUI_NOTIFY_MIN_PRICE`     | Minimum product price to trigger notify    | `50` (ignore items <$50)   |
| `LUMENTUI_NOTIFY_KEYWORDS`      | Product title must contain one of keywords | `gaming,mouse,keyboard`    |
| `NOTIFICATION_THROTTLE_MINUTES` | Rate limit per product (cooldown period)   | `60` (1 hour, recommended) |

**Example:** Only notify about gaming products over $100:

```bash
LUMENTUI_NOTIFY_MIN_PRICE=100
LUMENTUI_NOTIFY_KEYWORDS=gaming,esports
```

### Rate Limiting

To prevent notification spam, LumenTUI enforces a **60-minute cooldown** per product:

- After sending any notification for a product, no further notifications for that product will be sent for 60 minutes
- Rate limit applies across all notification types (new product, price change, availability change)
- Different products have independent rate limits
- Rate limit persists across daemon restarts (stored in database)

**Example:** Product A's price drops at 2:00 PM:

- ✅ 2:00 PM - Price drop notification sent
- ❌ 2:15 PM - Product goes out of stock (notification blocked, within 60-min window)
- ❌ 2:45 PM - Product back in stock (notification blocked, within 60-min window)
- ✅ 3:01 PM - Price increases (notification sent, cooldown expired)

---

## 🔧 Configuration

### Environment Variables

| Variable                          | Description                                   | Default                    | Required |
| --------------------------------- | --------------------------------------------- | -------------------------- | -------- |
| `LUMENTUI_SHOP_URL`               | Shopify store URL                             | https://shop.lumenalta.com | ✅       |
| `DB_PATH`                         | SQLite database path                          | data/lumentui.db           | ❌       |
| `LOG_LEVEL`                       | Logging level                                 | info                       | ❌       |
| `LOG_FILE`                        | Log file path                                 | data/logs/app.log          | ❌       |
| `SHOPIFY_TIMEOUT_MS`              | API timeout                                   | 10000                      | ❌       |
| `SHOPIFY_RETRY_ATTEMPTS`          | Retry attempts                                | 3                          | ❌       |
| `LUMENTUI_COOKIES`                | Manual cookie override                        | -                          | ❌       |
| `LUMENTUI_NOTIFY_PRICE_THRESHOLD` | Min % price change to notify (0 = any change) | 0                          | ❌       |
| `LUMENTUI_NOTIFY_MIN_PRICE`       | Minimum product price to notify               | 0                          | ❌       |
| `LUMENTUI_NOTIFY_KEYWORDS`        | Comma-separated keywords filter               | -                          | ❌       |
| `NOTIFICATION_THROTTLE_MINUTES`   | Rate limit cooldown per product (minutes)     | 60                         | ❌       |

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
│       ├── notification/          # macOS notifications
│       │   └── notification.service.ts
│       │
│       ├── scheduler/             # Polling scheduler
│       │   └── scheduler.service.ts
│       │
│       └── ipc/                   # Unix socket IPC
│           └── ipc.gateway.ts
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
3. Run `lumentui login` again

**Problem:** `❌ No valid session`

**Solution:**

```bash
# Clear old cookies and re-authenticate
lumentui logout
lumentui login
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
# Stop daemon
lumentui stop

# Backup old database (macOS/Linux)
cp ~/.local/share/lumentui/lumentui.db ~/.local/share/lumentui/lumentui.db.backup

# Start fresh (database will be recreated)
rm ~/.local/share/lumentui/lumentui.db
lumentui start
```

---

### Notification Issues

**Problem:** macOS notifications not appearing

**Solution:**

1. Check notification permissions: System Settings > Notifications > Terminal (or your app)
2. Verify notifications are enabled in your environment
3. Check logs for notification errors: `lumentui logs`

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
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild
pnpm run build
pnpm test
```

**Problem:** Test database conflicts

**Solution:**
Tests use in-memory SQLite by default. If issues persist:

```bash
# Use separate test database
DB_PATH=:memory: pnpm test
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
pnpm exec nest g module modules/mymodule
pnpm exec nest g service modules/mymodule
pnpm exec nest g controller modules/mymodule
```

### Running Linter

```bash
pnpm run lint
```

### Formatting Code

```bash
pnpm run format
```

### Debugging

```bash
# Start with Node inspector
pnpm run dev:debug

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
GitHub: [@victorstein](https://github.com/victorstein)

---

## 🙏 Acknowledgments

- **NestJS** - Framework foundation
- **node-notifier** - macOS notification integration
- **Shopify** - Storefront API
- **chrome-cookies-secure** - Cookie extraction
- **sql.js** - WASM-based SQLite database layer

---

## 📅 Changelog

### v1.2.3 (2026-02-03)

✅ Latest release:

- Daemon mode with background process management
- Full CLI with login, start, stop, status, logs, config, poll commands
- IPC layer (Unix sockets/Named pipes)
- Cross-platform path support (macOS, Linux, Windows)
- PID file management
- Configurable poll interval
- Automated releases via GitHub Actions
- npm and Homebrew distribution

### v1.0.0 (2025-01-21)

✅ Initial release:

- Auth module with Chrome cookie extraction
- API module with Shopify integration + retry logic
- Storage module with SQLite persistence
- Scheduler module with configurable polling
- Notification module with native macOS notifications
- Full test coverage (179 tests, 93%+ coverage on core services)
- CLI interface with Commander.js

---

## 🚀 Roadmap

### Phase 2 (Completed ✅)

- [x] Daemon mode with background process management
- [x] Ink-based TUI (React terminal interface)
- [x] IPC communication (Unix sockets/Named pipes)
- [x] Real-time product list view
- [x] CLI commands (login, start, stop, status, logs, config, poll)
- [x] Configurable poll interval
- [x] Cross-platform path support (macOS, Linux, Windows)
- [x] PID file management
- [x] GitHub Actions CI/CD pipeline
- [x] Homebrew tap distribution
- [x] npm package distribution

### Phase 3 (Current)

- [ ] Notification history view
- [ ] Product detail modal in TUI
- [ ] Interactive product filtering/search
- [ ] TUI settings panel
- [ ] Export product data (JSON/CSV)

---

**Made with ❤️ and TypeScript**
