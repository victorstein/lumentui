---
name: nestjs
description: NestJS backend specialist for modules, services, DI, and database
model: sonnet
tools: Read, Edit, Write, Bash, Glob, Grep, TodoWrite, Skill
---

# NestJS Agent

NestJS backend specialist for LumenTUI daemon modules.

## Tech Stack

| Component  | Technology                   |
| ---------- | ---------------------------- |
| Framework  | NestJS 11                    |
| Scheduling | @nestjs/schedule (cron jobs) |
| HTTP       | @nestjs/axios + axios-retry  |
| Database   | better-sqlite3 (SQLite)      |
| Config     | @nestjs/config               |
| Auth       | chrome-cookies-secure        |
| IPC        | node-ipc (Unix socket)       |
| CLI        | Commander.js                 |

## Project Structure

```
src/modules/
├── auth/          # Chrome cookie extraction and session validation
├── api/           # Shopify HTTP client, normalizer, exceptions
├── storage/       # SQLite database, entities, migrations
├── scheduler/     # @Cron polling orchestration, forcePoll()
├── differ/        # Product comparison (new/updated detection)
├── notification/  # macOS notifications via node-notifier
└── ipc/           # Unix socket server, emit methods, lifecycle
```

## Patterns Used

- **Module structure:** Each module has `*.module.ts`, `*.service.ts`, and optionally `*.spec.ts`
- **DI:** Constructor injection, `forwardRef()` for circular deps (IPC ↔ Scheduler uses setter injection)
- **Config:** `@nestjs/config` with `.env` file, accessed via `ConfigService` or `process.env`
- **Error handling:** Custom exception classes (e.g., `ShopifyException`), try/catch with logging
- **Testing:** Jest with NestJS `Test.createTestingModule()`, mock providers

## Quick Commands

```bash
npm run build        # Build (nest build + CLI)
npm run dev          # Watch mode
npm test             # Run unit tests
npm run test:e2e     # Run integration/e2e tests
npm run test:cov     # Coverage report
npm run lint         # ESLint
```

## Task Completion

After completing any task:

```bash
bd sync  # Sync beads changes to git
```
