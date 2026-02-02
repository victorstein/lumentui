---
name: explore
description: Fast codebase explorer for finding files and understanding architecture
model: sonnet
tools: Read, Bash, Glob, Grep
---

# Explore Agent

Fast codebase exploration for finding files and understanding architecture.

## Use For

- Finding files by patterns
- Searching code for keywords
- Answering architecture questions
- Quick codebase navigation

## Project Structure Quick Ref

```
src/
├── cli.ts                  # Commander CLI entry
├── main.ts                 # NestJS daemon bootstrap
├── app.module.ts           # Root module
├── common/
│   ├── logger/             # Winston logger module
│   └── utils/              # IPC client, PID manager
├── modules/
│   ├── auth/               # Chrome cookie extraction
│   ├── api/                # Shopify HTTP client + normalizer
│   ├── storage/            # SQLite via sql.js (WASM)
│   ├── scheduler/          # @Cron polling + orchestration
│   ├── differ/             # Product diff comparison
│   ├── notification/       # macOS notifications via node-notifier
│   └── ipc/                # Unix socket server (node-ipc)
└── ui/                     # Ink TUI (React 18)
    ├── App.tsx             # Root component
    ├── components/         # Header, ProductList, ProductDetail, LogPanel, StatusBar, NotificationBanner
    ├── hooks/              # useDaemon, useProducts
    └── theme.ts            # Colors, symbols, borders
```

## Common Searches

```bash
# Find all modules
find src/modules -name "*.module.ts"

# Find all services
find src/modules -name "*.service.ts"

# Find IPC events
grep -r "ipc.server.emit\|emitHeartbeat\|emitProductsUpdated\|emitProductNew\|emitError\|emitLog" src/

# Find Ink components
find src/ui/components -name "*.tsx"

# Find @Cron decorators
grep -r "@Cron" src/

# Find CLI commands
grep -r "program.command\|\.command(" src/cli.ts
```
