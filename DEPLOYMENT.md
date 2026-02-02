# 🚀 LumentuiAPI - Deployment Guide

Complete guide for deploying LumentuiAPI to production environment.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Environment Setup](#production-environment-setup)
3. [Configuration](#configuration)
4. [PM2 Setup](#pm2-setup)
5. [Database Management](#database-management)
6. [Logging & Monitoring](#logging--monitoring)
7. [Backup Strategy](#backup-strategy)
8. [Update Procedure](#update-procedure)
9. [Troubleshooting](#troubleshooting)
10. [Security Checklist](#security-checklist)

---

## Prerequisites

### System Requirements

- **Operating System:** macOS 10.15+ or Linux (Ubuntu 20.04+)
- **Node.js:** 18.x or higher (LTS recommended)
- **npm:** 9.x or higher
- **PM2:** 5.x or higher (process manager)
- **Chrome Browser:** Latest stable version
- **Clawdbot:** Installed and configured
- **Disk Space:** Minimum 500MB free
- **Memory:** Minimum 512MB RAM available

### Software Installation

```bash
# Install Node.js (if not already installed)
# macOS:
brew install node@18

# Ubuntu:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Verify installations
node --version   # Should be >= v18.0.0
npm --version    # Should be >= 9.0.0
pm2 --version    # Should be >= 5.0.0
```

### Clawdbot Setup

```bash
# Verify Clawdbot is running
clawdbot gateway status

# If not running, start it
clawdbot gateway start

# Test WhatsApp integration
message --action=send --channel=whatsapp --target=+50586826131 --message="LumentuiAPI deployment test"
```

---

## Production Environment Setup

### 1. Clone Repository

```bash
# Create production directory
mkdir -p ~/production
cd ~/production

# Clone repository (or copy from development)
cp -r ~/clawd/development/lumentui/lumentui ./lumentui-prod
cd lumentui-prod
```

### 2. Install Dependencies

```bash
# Install production dependencies only
npm ci --production

# Or install all dependencies (includes devDependencies for building)
npm ci
```

### 3. Build Application

```bash
# Build TypeScript to JavaScript
npm run build

# Verify build output
ls -la dist/
```

Expected output:
```
dist/
├── app.controller.js
├── app.module.js
├── app.service.js
├── cli.js
├── main.js
├── common/
└── modules/
```

---

## Configuration

### Environment Variables

#### 1. Create Production Environment File

```bash
cp .env.example .env.production
```

#### 2. Edit `.env.production`

```bash
# ==========================================
# LumentuiAPI Production Configuration
# ==========================================

# === Core Settings ===
NODE_ENV=production
LOG_LEVEL=info

# === Database Configuration ===
DB_PATH=/home/clawdbot/production/lumentui-prod/data/lumentui.db

# === Shopify API Configuration ===
LUMENTUI_SHOP_URL=https://shop.lumenalta.com
SHOPIFY_TIMEOUT_MS=15000
SHOPIFY_RETRY_ATTEMPTS=5

# === Scheduler Configuration ===
# Poll every 30 minutes (1800 seconds)
LUMENTUI_POLL_INTERVAL=1800
SCHEDULER_ENABLED=true

# === Notification Configuration ===
NOTIFICATION_PHONE=+50586826131
NOTIFICATION_ENABLED=true
# Throttle: 1 notification per hour per product
NOTIFICATION_THROTTLE_MINUTES=60

# === Authentication ===
LUMENTUI_COOKIES_PATH=/home/clawdbot/production/lumentui-prod/data/cookies.json
LUMENTUI_USER_AGENT=LumenTUI/1.0

# === Logging Configuration ===
LOG_FILE=/home/clawdbot/production/lumentui-prod/data/logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=14d

# === Chrome Integration ===
# Chrome profile name (for cookie extraction)
CHROME_PROFILE=Default
```

#### 3. Secure Environment File

```bash
# Restrict permissions (owner read/write only)
chmod 600 .env.production

# Verify permissions
ls -la .env.production
# Should show: -rw------- (600)
```

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment name | `production` | ✅ |
| `DB_PATH` | SQLite database path | `/full/path/to/db` | ✅ |
| `NOTIFICATION_PHONE` | WhatsApp target (E.164) | `+50586826131` | ✅ |
| `LUMENTUI_SHOP_URL` | Shopify store URL | `https://shop.lumenalta.com` | ✅ |
| `LOG_LEVEL` | Logging level | `info` or `warn` | ✅ |
| `LUMENTUI_POLL_INTERVAL` | Polling interval (seconds) | `1800` (30 min) | ✅ |

---

## PM2 Setup

### Ecosystem Configuration

PM2 configuration is defined in `ecosystem.config.js`:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'lumentui-api',
      script: './dist/main.js',
      cwd: '/home/clawdbot/production/lumentui-prod',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment
      env_production: {
        NODE_ENV: 'production',
      },
      env_file: '.env.production',
      
      // Logging
      error_file: './data/logs/pm2-error.log',
      out_file: './data/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart strategy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      
      // Resource limits
      max_memory_restart: '300M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Watch (disabled in production)
      watch: false,
      ignore_watch: ['node_modules', 'data', 'logs', '.git'],
      
      // Advanced
      source_map_support: true,
      instance_var: 'INSTANCE_ID',
    },
  ],
};
```

### Start Application with PM2

#### 1. First-time Setup

```bash
# Navigate to production directory
cd ~/production/lumentui-prod

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs (sudo required)
```

#### 2. Verify Running

```bash
# Check process status
pm2 status

# Expected output:
# ┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┬────────┐
# │ id  │ name         │ mode    │ status  │ restart │ uptime   │ cpu    │
# ├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┼────────┤
# │ 0   │ lumentui-api │ fork    │ online  │ 0       │ 5m       │ 0.2%   │
# └─────┴──────────────┴─────────┴─────────┴─────────┴──────────┴────────┘

# View real-time logs
pm2 logs lumentui-api

# View specific log file
pm2 logs lumentui-api --lines 100
```

#### 3. Manage Process

```bash
# Restart application
pm2 restart lumentui-api

# Stop application
pm2 stop lumentui-api

# Delete from PM2
pm2 delete lumentui-api

# Reload (zero-downtime restart)
pm2 reload lumentui-api

# View detailed info
pm2 info lumentui-api
```

---

## Database Management

### Database Location

Production database: `/home/clawdbot/production/lumentui-prod/data/lumentui.db`

### Database Schema

Schema is automatically created on first run. Verify with:

```bash
sqlite3 data/lumentui.db ".schema"
```

### Manual Database Operations

#### View Products

```bash
sqlite3 data/lumentui.db "SELECT id, title, available_for_sale, last_seen_at FROM products LIMIT 10;"
```

#### Check Database Size

```bash
du -h data/lumentui.db
```

#### Vacuum Database (Optimize)

```bash
# Stop application first
pm2 stop lumentui-api

# Vacuum database
sqlite3 data/lumentui.db "VACUUM;"

# Restart application
pm2 start lumentui-api
```

### Database Migrations

Currently no migration system. Future schema changes will require manual migration scripts.

---

## Logging & Monitoring

### Log Files

| Log File | Description | Rotation |
|----------|-------------|----------|
| `data/logs/app.log` | Application logs (Winston) | Daily, 14 days |
| `data/logs/pm2-out.log` | PM2 stdout | Manual |
| `data/logs/pm2-error.log` | PM2 stderr | Manual |

### Log Rotation

#### Winston (Application Logs)

Winston automatically rotates logs based on `.env.production`:

```bash
LOG_FILE=data/logs/app-%DATE%.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=14d
```

#### PM2 Logs

PM2 logs require manual rotation. Setup with PM2 log rotate module:

```bash
# Install PM2 log rotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Monitoring Commands

```bash
# Real-time monitoring dashboard
pm2 monit

# View resource usage
pm2 show lumentui-api

# Check system health
pm2 info lumentui-api

# View logs (last 100 lines)
pm2 logs lumentui-api --lines 100

# Tail error log
tail -f data/logs/pm2-error.log
```

### Health Checks

#### Application Health Endpoint

```bash
# Check health (if HTTP server is running)
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-21T12:00:00.000Z"}
```

#### Process Health

```bash
# Check if process is running
pm2 status lumentui-api | grep online

# Check uptime
pm2 info lumentui-api | grep uptime

# Check restart count
pm2 info lumentui-api | grep restarts
```

### Alerting

Setup PM2 notifications for crashes:

```bash
# Install PM2 notify module
pm2 install pm2-notify

# Configure notifications (example)
pm2 set pm2-notify:email your-email@example.com
```

---

## Backup Strategy

### Database Backup

#### Automated Daily Backup

Create backup script: `scripts/backup.sh`

```bash
#!/bin/bash
# scripts/backup.sh - Daily database backup

BACKUP_DIR="/home/clawdbot/production/lumentui-prod/backups"
DB_PATH="/home/clawdbot/production/lumentui-prod/data/lumentui.db"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/lumentui-$DATE.db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_FILE"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "lumentui-*.db.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_FILE.gz"
```

Make executable:

```bash
chmod +x scripts/backup.sh
```

#### Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /home/clawdbot/production/lumentui-prod/scripts/backup.sh >> /home/clawdbot/production/lumentui-prod/data/logs/backup.log 2>&1
```

#### Manual Backup

```bash
# One-time backup
sqlite3 data/lumentui.db ".backup 'data/backups/manual-$(date +%Y%m%d).db'"
```

### Configuration Backup

```bash
# Backup all configuration files
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  .env.production \
  ecosystem.config.js \
  package.json \
  package-lock.json

# Store in backup directory
mv config-backup-*.tar.gz backups/
```

### Restore from Backup

```bash
# Stop application
pm2 stop lumentui-api

# Restore database
gunzip -c backups/lumentui-2025-01-20.db.gz > data/lumentui.db

# Restart application
pm2 start lumentui-api

# Verify
pm2 logs lumentui-api
```

---

## Update Procedure

### Pre-update Checklist

- [ ] Backup database
- [ ] Backup configuration files
- [ ] Check PM2 status
- [ ] Note current commit/version

### Update Steps

#### 1. Backup Current State

```bash
# Navigate to production directory
cd ~/production/lumentui-prod

# Create backup
./scripts/backup.sh

# Backup config
cp .env.production .env.production.bak
cp ecosystem.config.js ecosystem.config.js.bak
```

#### 2. Pull Latest Code

```bash
# Pull from git
git fetch origin
git pull origin main

# Or copy from development
# cp -r ~/clawd/development/lumentui/lumentui/* .
```

#### 3. Update Dependencies

```bash
# Install new dependencies
npm ci --production
```

#### 4. Rebuild Application

```bash
# Build TypeScript
npm run build

# Verify build
ls -la dist/main.js
```

#### 5. Run Tests (Optional)

```bash
# Install dev dependencies if needed
npm ci

# Run tests
npm test

# Check coverage
npm run test:cov
```

#### 6. Restart Application

```bash
# Graceful reload (zero-downtime)
pm2 reload lumentui-api

# Or full restart
pm2 restart lumentui-api

# Watch logs for errors
pm2 logs lumentui-api --lines 50
```

#### 7. Verify Update

```bash
# Check process status
pm2 status

# Check logs for errors
pm2 logs lumentui-api --err --lines 20

# Test notification (optional)
# Trigger a manual notification to verify system works
```

### Rollback Procedure

If update fails:

```bash
# Stop application
pm2 stop lumentui-api

# Restore database
cp backups/lumentui-YYYY-MM-DD.db data/lumentui.db

# Restore config
cp .env.production.bak .env.production

# Rollback code
git reset --hard HEAD~1

# Rebuild
npm ci --production
npm run build

# Restart
pm2 start lumentui-api

# Verify
pm2 logs lumentui-api
```

---

## Troubleshooting

### Application Won't Start

**Symptom:** `pm2 status` shows status as `errored` or `stopped`

**Solutions:**

1. Check PM2 error logs:
   ```bash
   pm2 logs lumentui-api --err --lines 50
   ```

2. Check environment variables:
   ```bash
   pm2 env lumentui-api
   ```

3. Verify database path exists:
   ```bash
   ls -la data/lumentui.db
   ```

4. Check file permissions:
   ```bash
   ls -la .env.production
   ls -la data/
   ```

5. Test manual start:
   ```bash
   node dist/main.js
   ```

### High Memory Usage

**Symptom:** Process uses >300MB RAM

**Solutions:**

1. Check for memory leaks:
   ```bash
   pm2 monit
   ```

2. Reduce polling frequency:
   ```bash
   # In .env.production
   LUMENTUI_POLL_INTERVAL=3600  # 1 hour instead of 30 min
   ```

3. Restart application:
   ```bash
   pm2 restart lumentui-api
   ```

### Database Locked Error

**Symptom:** `SQLITE_BUSY: database is locked`

**Solutions:**

1. Check for multiple instances:
   ```bash
   pm2 list
   ps aux | grep lumentui
   ```

2. Stop all instances:
   ```bash
   pm2 delete all
   killall node
   ```

3. Remove lock files:
   ```bash
   rm data/lumentui.db-wal
   rm data/lumentui.db-shm
   ```

4. Restart single instance:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

### Notifications Not Sending

**Symptom:** No WhatsApp messages received

**Solutions:**

1. Verify Clawdbot is running:
   ```bash
   clawdbot gateway status
   ```

2. Check phone number format (must be E.164):
   ```bash
   grep NOTIFICATION_PHONE .env.production
   # Should be: +50586826131 (with country code)
   ```

3. Test notification manually:
   ```bash
   message --action=send --channel=whatsapp --target=+50586826131 --message="Test"
   ```

4. Check application logs:
   ```bash
   grep "notification" data/logs/app.log
   ```

### Cookie Authentication Failed

**Symptom:** `401 Unauthorized` or `No valid session`

**Solutions:**

1. Re-authenticate:
   ```bash
   node dist/cli.js auth
   ```

2. Check cookie file:
   ```bash
   cat data/cookies.json
   ```

3. Verify Chrome session:
   - Open Chrome
   - Navigate to https://shop.lumenalta.com
   - Ensure you're logged in

4. Grant Keychain access:
   - macOS will prompt for Keychain access
   - Click "Always Allow"

---

## Security Checklist

### File Permissions

```bash
# Environment files
chmod 600 .env.production

# Database
chmod 600 data/lumentui.db

# Cookie storage
chmod 600 data/cookies.json

# Log directory
chmod 700 data/logs/

# Executable scripts
chmod 700 scripts/*.sh
```

### Network Security

- [ ] Application runs on localhost only (no external ports)
- [ ] Clawdbot gateway is secured
- [ ] SSH access is key-based (no password auth)
- [ ] Firewall is enabled and configured

### Access Control

- [ ] Application runs as non-root user
- [ ] PM2 runs under same user
- [ ] Database is not publicly accessible
- [ ] Logs are protected (chmod 600)

### Secrets Management

- [ ] `.env.production` is never committed to git
- [ ] Cookies are stored securely (Keychain)
- [ ] Phone numbers are in E.164 format
- [ ] No secrets in log files

### Monitoring

- [ ] PM2 process monitoring is active
- [ ] Log rotation is configured
- [ ] Disk space monitoring is enabled
- [ ] Backup strategy is implemented

---

## Production Checklist

Before going live:

- [ ] All tests passing (76/76)
- [ ] Code coverage >90% on core services
- [ ] `.env.production` configured
- [ ] PM2 ecosystem.config.js created
- [ ] PM2 startup script configured
- [ ] Database backup script created
- [ ] Backup cron job scheduled
- [ ] Log rotation configured
- [ ] File permissions secured
- [ ] Clawdbot integration tested
- [ ] Health checks verified
- [ ] Monitoring dashboard setup
- [ ] Documentation reviewed
- [ ] Rollback procedure tested

---

## Support

For issues or questions:

- **Email:** stein.hakase.vs@gmail.com
- **GitHub:** Check for open issues
- **Logs:** Always include relevant logs when reporting issues

---

**Last Updated:** 2025-01-21  
**Version:** 1.0.0
