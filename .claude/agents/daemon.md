---
name: daemon
description: Daemon process specialist for polling, IPC, and notifications
model: sonnet
tools: Read, Edit, Write, Bash, Glob, Grep, TodoWrite, Skill
---

# Daemon Agent

Daemon process specialist for polling, IPC server, and notifications.

## Focus Areas

- **SchedulerModule** — @Cron polling via `SchedulerService.handlePoll()`, `forcePoll()` for on-demand polling
- **DifferModule** — `DifferService.compare()` detects new/updated products
- **IpcModule** — Unix socket server via `IpcGateway`, emits heartbeat, product updates, errors, logs
- **NotificationModule** — macOS native notifications via node-notifier, rate-limited, filtered by price/keywords

## Key Files

```
src/modules/scheduler/scheduler.service.ts   # Poll orchestration, forcePoll(), notification integration
src/modules/scheduler/scheduler.module.ts     # Imports IpcModule, NotificationModule, DifferModule
src/modules/differ/differ.service.ts          # compare(existing, new) → { newProducts, updatedProducts }
src/modules/ipc/ipc.gateway.ts                # Unix socket server, emit methods, force-poll handler
src/modules/notification/notification.service.ts  # sendAvailabilityNotification(), shouldNotify() filters
src/main.ts                                   # Daemon bootstrap with graceful shutdown
```

## Architecture

```
SchedulerService (@Cron every 30min or forcePoll)
  → ShopifyService.getProducts()
  → DifferService.compare(existing, new)
  → DatabaseService.saveProducts()
  → IpcGateway.emitProductsUpdated() / emitProductNew()
  → NotificationService.shouldNotify() → sendAvailabilityNotification()
```

## Quick Commands

```bash
pnpm run start:daemon   # Run daemon directly
pnpm run dev            # Watch mode
pnpm test               # Run tests
```

## Task Completion

After completing any task:

```bash
bd sync  # Sync beads changes to git
```
