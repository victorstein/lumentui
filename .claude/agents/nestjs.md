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
| Database   | sql.js (WASM SQLite)         |
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

## Code Standards

### Self-Documenting Code (Comments Restricted)

**CRITICAL:** Code must be self-documenting. Comments are restricted to only critical scenarios.

Write clear code through:

- Descriptive variable/function names
- Small, focused functions
- TypeScript types that convey intent

**ONLY comment for:**

- Complex algorithms where "why" isn't obvious
- Workarounds for bugs (with ESLint justifications)
- Security-sensitive code

**NEVER comment for:**

- What code does (code should show this)
- Obvious operations
- Function purposes (name should convey this)

**Before commenting, ask:**

1. Can I rename to make this clearer?
2. Can I refactor into smaller functions?
3. Can I use types to convey this?

### Module Resolution (ESM/CommonJS)

**ALWAYS use `PathsUtil` for file paths** — never use `__dirname` or `import.meta` directly.

`PathsUtil.getDirname()` handles both CommonJS (tests) and ESM (production) using a `Function()` wrapper to hide `import.meta` from Jest's parser.

See `src/common/utils/paths.util.ts:19-31` for the canonical implementation.

## Quick Commands

```bash
pnpm run build        # Build (nest build + CLI)
pnpm run dev          # Watch mode
pnpm test             # Run unit tests
pnpm run test:e2e     # Run integration/e2e tests
pnpm run test:cov     # Coverage report
pnpm run lint         # ESLint
```

## Task Completion

After completing any task:

```bash
bd sync  # Sync beads changes to git
```
