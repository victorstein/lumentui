# 📟 LumentuiAPI CLI Usage Guide

Complete guide for using the LumentuiAPI command-line interface.

---

## 📋 Table of Contents

1. [Installation](#installation)
2. [Global Commands](#global-commands)
3. [Authentication Commands](#authentication-commands)
4. [Daemon Commands](#daemon-commands)
5. [Product Commands](#product-commands)
6. [Configuration Commands](#configuration-commands)
7. [Troubleshooting Commands](#troubleshooting-commands)
8. [Advanced Usage](#advanced-usage)
9. [Examples](#examples)

---

## 🚀 Installation

### Local Installation

```bash
cd ~/clawd/development/lumentui/lumentui
npm install
npm run build
```

### Global Installation (Optional)

```bash
npm link
# Now 'lumentui' command is available globally
```

### Verify Installation

```bash
node dist/cli.js --version
# or if globally installed:
lumentui --version
```

Expected output:

```
0.0.1
```

---

## 🌐 Global Commands

### Help

Display help information for all commands.

```bash
lumentui --help
lumentui -h
```

**Output:**

```
Usage: lumentui [options] [command]

LumenTUI - CLI for Lumenalta Shop product monitoring

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  auth [options]     Authenticate with shop.lumenalta.com
  start              Start daemon and TUI
  stop               Stop daemon
  status             Check daemon status
  list               List products
  help [command]     display help for command
```

### Version

Display the current version of LumentuiAPI.

```bash
lumentui --version
lumentui -V
```

**Output:**

```
0.0.1
```

---

## 🔐 Authentication Commands

### `auth` - Authenticate with Shopify

Extract and store cookies from Chrome for shop.lumenalta.com.

#### Basic Usage

```bash
lumentui auth
```

**What happens:**

1. Prompts for macOS Keychain access (first time only)
2. Extracts cookies from Chrome
3. Validates cookie format
4. Saves to `data/cookies.json`
5. Confirms success

**Output:**

```
🔐 Extracting cookies from Chrome...
⚠️  macOS will ask for Keychain permission (first time only)
✅ Authentication successful!
```

**Prerequisites:**

- Must be logged into shop.lumenalta.com in Chrome
- Chrome must be closed or cookies may be locked
- macOS Keychain access required

#### Check Current Session

Verify if your stored session is still valid.

```bash
lumentui auth --check
```

**Output (valid session):**

```
✅ Session is valid
```

**Output (invalid/expired session):**

```
❌ No valid session. Run: lumentui auth
```

**Exit codes:**

- `0` - Session is valid
- `1` - Session is invalid or missing

#### Force Re-authentication

Clear existing cookies and re-authenticate.

```bash
rm data/cookies.json
lumentui auth
```

---

## 🔄 Daemon Commands

### `start` - Start Daemon

Launch the background daemon and optional TUI interface.

#### Basic Usage

```bash
lumentui start
```

**What happens:**

1. Checks for existing daemon
2. Validates authentication cookies
3. Starts NestJS application
4. Initializes polling scheduler (30min intervals)
5. Opens IPC socket at `/tmp/lumentui.sock`
6. (Optional) Launches Ink TUI

**Output:**

```
🚀 Starting LumentuiAPI daemon...
✅ Daemon started (PID: 12345)
📡 IPC socket: /tmp/lumentui.sock
⏰ Polling every 30 minutes
```

#### Daemon Mode (Background)

Start daemon without TUI (background only).

```bash
lumentui start --daemon
lumentui start -d
```

**Output:**

```
🚀 Starting LumentuiAPI daemon...
✅ Daemon started (PID: 12345)
ℹ️  Run 'lumentui status' to check status
```

#### Development Mode

Start with debug logging enabled.

```bash
LOG_LEVEL=debug lumentui start
```

**Output:**

```
🚀 Starting LumentuiAPI daemon...
[DEBUG] Loading configuration from .env
[DEBUG] Connecting to SQLite database: data/lumentui.db
[DEBUG] Initializing scheduler: */30 * * * *
✅ Daemon started (PID: 12345)
```

#### Custom Poll Interval

Override default 30-minute polling interval.

```bash
LUMENTUI_POLL_INTERVAL=60 lumentui start
```

---

### `stop` - Stop Daemon

Gracefully stop the running daemon.

#### Basic Usage

```bash
lumentui stop
```

**What happens:**

1. Connects to daemon via IPC socket
2. Sends shutdown signal
3. Waits for graceful termination
4. Closes database connections
5. Removes IPC socket

**Output:**

```
🛑 Stopping LumentuiAPI daemon...
✅ Daemon stopped successfully
```

#### Force Stop

Forcefully terminate daemon if not responding.

```bash
lumentui stop --force
lumentui stop -f
```

**Output:**

```
🛑 Force stopping LumentuiAPI daemon...
⚠️  Daemon killed (SIGKILL)
✅ Cleanup complete
```

**Warning:** Force stop may leave database locks. Use only if graceful stop fails.

---

### `status` - Check Daemon Status

Display current daemon status and statistics.

#### Basic Usage

```bash
lumentui status
```

**Output (daemon running):**

```
✅ Daemon Status: Running
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Process Info:
  PID:              12345
  Uptime:           2h 34m 12s
  Memory Usage:     52.4 MB
  CPU Usage:        1.2%

Monitoring:
  Last Poll:        5 minutes ago
  Next Poll:        25 minutes
  Total Polls:      6
  Products Tracked: 42

Database:
  Path:             data/lumentui.db
  Size:             2.1 MB
  Products:         42

Notifications:
  Sent Today:       3
  Last Notification: 1h 23m ago
```

**Output (daemon not running):**

```
❌ Daemon Status: Not Running
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Run 'lumentui start' to start daemon
```

#### Watch Mode

Continuously monitor daemon status (updates every 5 seconds).

```bash
lumentui status --watch
lumentui status -w
```

**Output:**

```
✅ Daemon Status: Running (refreshing every 5s)

Process Info:
  PID:              12345
  Uptime:           2h 34m 17s  ← Updates in real-time
  Memory Usage:     52.5 MB
  ...

Press Ctrl+C to exit
```

#### JSON Output

Output status as JSON for scripting.

```bash
lumentui status --json
```

**Output:**

```json
{
  "status": "running",
  "pid": 12345,
  "uptime": 9252,
  "memory": 52428800,
  "cpu": 1.2,
  "lastPoll": "2025-01-21T15:25:00.000Z",
  "nextPoll": "2025-01-21T15:55:00.000Z",
  "productsTracked": 42,
  "notificationsSent": 3
}
```

---

## 📦 Product Commands

### `list` - List Products

Display all tracked products.

#### Basic Usage

```bash
lumentui list
```

**Output:**

```
📦 Tracked Products (42 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Premium Wireless Headphones
   Handle:      wireless-headphones
   Price:       $299.99
   Available:   ✅ Yes
   Last Seen:   5 minutes ago

❌ Gaming Keyboard RGB
   Handle:      gaming-keyboard-rgb
   Price:       $149.99
   Available:   ❌ Out of Stock
   Last Seen:   5 minutes ago

✅ 4K Webcam Pro
   Handle:      4k-webcam-pro
   Price:       $199.99
   Available:   ✅ Yes
   Last Seen:   5 minutes ago

... (39 more products)
```

#### Filter by Availability

Show only available products.

```bash
lumentui list --available
lumentui list -a
```

**Output:**

```
📦 Available Products (8 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Premium Wireless Headphones ($299.99)
✅ 4K Webcam Pro ($199.99)
✅ Mechanical Mouse ($79.99)
... (5 more products)
```

#### Filter by Product Type

Show products of a specific type.

```bash
lumentui list --type="Electronics"
```

**Output:**

```
📦 Electronics (15 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Premium Wireless Headphones ($299.99)
✅ 4K Webcam Pro ($199.99)
❌ Gaming Keyboard RGB ($149.99)
...
```

#### Sort Options

```bash
# Sort by price (ascending)
lumentui list --sort=price

# Sort by price (descending)
lumentui list --sort=price --desc

# Sort by last seen (most recent first)
lumentui list --sort=date

# Sort by availability
lumentui list --sort=available
```

#### JSON Output

```bash
lumentui list --json > products.json
```

**Output:**

```json
[
  {
    "id": "gid://shopify/Product/1234567890",
    "handle": "wireless-headphones",
    "title": "Premium Wireless Headphones",
    "price": 299.99,
    "availableForSale": true,
    "lastSeenAt": "2025-01-21T15:30:00.000Z"
  },
  ...
]
```

#### Limit Results

```bash
# Show first 10 products
lumentui list --limit=10
lumentui list -n 10
```

---

### `show` - Show Product Details

Display detailed information about a specific product.

```bash
lumentui show <handle>
```

**Example:**

```bash
lumentui show wireless-headphones
```

**Output:**

```
📦 Product Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title:           Premium Wireless Headphones
Handle:          wireless-headphones
Vendor:          Lumenalta
Product Type:    Electronics
Price:           $299.99

Availability:    ✅ Available
Last Available:  1 hour ago

Description:
High-quality wireless headphones with active noise
cancellation, 30-hour battery life, and premium
comfort. Perfect for music lovers and professionals.

Variants:
  • Black - $299.99 ✅
  • White - $299.99 ❌
  • Silver - $309.99 ✅

Tags:
  • audio
  • wireless
  • premium
  • noise-cancelling

Tracking:
  First Seen:    2025-01-15 10:00:00
  Last Seen:     2025-01-21 15:30:00
  Last Updated:  2025-01-21 15:30:00

URL:
https://shop.lumenalta.com/products/wireless-headphones
```

---

## ⚙️ Configuration Commands

### `config` - Manage Configuration

View or modify configuration settings.

#### View All Settings

```bash
lumentui config --list
```

**Output:**

```
⚙️  Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Shop URL:          https://shop.lumenalta.com
Poll Interval:     30 minutes
Notification Phone: +50586826131
Database Path:     data/lumentui.db
Log Level:         info
Log File:          data/logs/app.log
```

#### Set Configuration Value

```bash
lumentui config set LUMENTUI_POLL_INTERVAL 60
```

**Output:**

```
✅ Configuration updated: LUMENTUI_POLL_INTERVAL = 60
⚠️  Restart daemon for changes to take effect
```

#### Get Configuration Value

```bash
lumentui config get LUMENTUI_POLL_INTERVAL
```

**Output:**

```
60
```

#### Reset Configuration

```bash
lumentui config reset
```

**Output:**

```
⚠️  This will reset all configuration to defaults.
Continue? (y/N): y
✅ Configuration reset to defaults
```

---

## 🔍 Troubleshooting Commands

### `logs` - View Logs

Display application logs.

#### Tail Logs (Live)

```bash
lumentui logs
lumentui logs --follow
lumentui logs -f
```

**Output:**

```
[2025-01-21 15:30:00] [INFO] Polling products...
[2025-01-21 15:30:02] [DEBUG] Fetching from Shopify API
[2025-01-21 15:30:03] [INFO] Found 42 products
[2025-01-21 15:30:03] [INFO] 2 new products detected
[2025-01-21 15:30:04] [INFO] Notification sent: +50586826131
```

#### Last N Lines

```bash
lumentui logs --lines=50
lumentui logs -n 50
```

#### Filter by Level

```bash
# Show only errors
lumentui logs --level=error

# Show errors and warnings
lumentui logs --level=warn
```

#### Filter by Date

```bash
# Today's logs
lumentui logs --since=today

# Last hour
lumentui logs --since=1h

# Specific date
lumentui logs --since="2025-01-21"
```

---

### `doctor` - Diagnose Issues

Run diagnostics to identify common problems.

```bash
lumentui doctor
```

**Output:**

```
🩺 Running Diagnostics...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Node.js version: v18.17.0 (OK)
✅ npm version: 9.8.1 (OK)
✅ Chrome installed: Yes
✅ Clawdbot available: Yes
✅ Database accessible: Yes
✅ Cookies file exists: Yes
✅ Cookies valid: Yes
❌ Daemon running: No
✅ IPC socket writable: Yes
✅ Disk space: 45.2 GB free (OK)
✅ Memory available: 8.4 GB (OK)

Recommendations:
  • Start daemon with: lumentui start
```

---

### `clean` - Clean Up Data

Remove old data and temporary files.

#### Clean Old Logs

```bash
lumentui clean --logs
```

**Output:**

```
🧹 Cleaning logs older than 30 days...
✅ Removed 15 log files (12.4 MB freed)
```

#### Clean Database

```bash
lumentui clean --db
```

**Output:**

```
⚠️  This will delete all tracked products!
Continue? (y/N): y
🧹 Cleaning database...
✅ Database cleared
```

#### Clean Everything

```bash
lumentui clean --all
```

**Output:**

```
⚠️  This will delete:
  • All logs
  • All database records
  • Cached data
Continue? (y/N): y
🧹 Cleaning...
✅ All data cleaned (45.6 MB freed)
```

---

## 🎓 Advanced Usage

### Scripting with JSON Output

```bash
#!/bin/bash

# Check if daemon is running
STATUS=$(lumentui status --json)
IS_RUNNING=$(echo $STATUS | jq -r '.status')

if [ "$IS_RUNNING" != "running" ]; then
  echo "Starting daemon..."
  lumentui start --daemon
fi

# Get available products
PRODUCTS=$(lumentui list --available --json)
COUNT=$(echo $PRODUCTS | jq 'length')

echo "Available products: $COUNT"
```

### Monitoring with Cron

```bash
# Check status every hour and restart if needed
0 * * * * /usr/local/bin/lumentui status || /usr/local/bin/lumentui start --daemon
```

### Integration with Other Tools

```bash
# Export products to CSV
lumentui list --json | jq -r '.[] | [.title, .price, .availableForSale] | @csv' > products.csv

# Send notification if new products
NEW_COUNT=$(lumentui list --available --json | jq 'length')
if [ "$NEW_COUNT" -gt 0 ]; then
  echo "Found $NEW_COUNT new products!"
fi
```

---

## 📝 Examples

### Example 1: Initial Setup

```bash
# Install and configure
cd ~/clawd/development/lumentui/lumentui
npm install
npm run build

# Authenticate
node dist/cli.js auth

# Start daemon
node dist/cli.js start --daemon

# Check status
node dist/cli.js status
```

### Example 2: Daily Monitoring

```bash
# Morning check
lumentui status
lumentui list --available

# View logs
lumentui logs --lines=20

# Check specific product
lumentui show wireless-headphones
```

### Example 3: Troubleshooting

```bash
# Something's not working
lumentui doctor

# Check logs for errors
lumentui logs --level=error --lines=50

# Re-authenticate
rm data/cookies.json
lumentui auth --check
lumentui auth

# Restart daemon
lumentui stop
lumentui start
```

### Example 4: Configuration Tuning

```bash
# Change poll interval to 1 hour
lumentui config set LUMENTUI_POLL_INTERVAL 3600

# Enable debug logging
lumentui config set LOG_LEVEL debug

# Restart to apply changes
lumentui stop
lumentui start
```

---

## 🆘 Getting Help

### Command-specific Help

```bash
lumentui auth --help
lumentui start --help
lumentui list --help
```

### Common Issues

| Issue               | Command                 | Solution                 |
| ------------------- | ----------------------- | ------------------------ |
| Daemon won't start  | `lumentui doctor`       | Check diagnostics output |
| Cookies expired     | `lumentui auth --check` | Re-authenticate          |
| No products showing | `lumentui logs -n 50`   | Check API errors         |
| High memory usage   | `lumentui status`       | Check uptime, restart    |

### Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Email: stein.hakase.vs@gmail.com

---

## 📚 See Also

- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines

---

**CLI Version:** 1.0.0  
**Last Updated:** 2025-01-21  
**Maintainer:** Stein Hakase (stein.hakase.vs@gmail.com)
