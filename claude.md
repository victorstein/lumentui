# LumenTUI

## Shared Rules (All Agents Must Follow)

### Project Structure

LumenTUI is a **single-package TypeScript application** with three components:

| Component | Location       | Purpose                                  |
| --------- | -------------- | ---------------------------------------- |
| Daemon    | `src/modules/` | NestJS background service (polling, IPC) |
| CLI       | `src/cli.ts`   | Commander.js CLI commands                |
| TUI       | `src/ui/`      | Ink/React terminal user interface        |
| Common    | `src/common/`  | Shared utilities and services            |

**Build commands**:

```bash
pnpm run build           # Full build (daemon + CLI + TUI)
pnpm run build:daemon    # Daemon only (NestJS)
pnpm run build:cli       # CLI only
pnpm run build:ui        # TUI only
pnpm test                # Run all tests
pnpm run test:watch      # Watch mode
pnpm run lint            # ESLint
pnpm run format          # Prettier
```

### Package Manager

Use `pnpm` exclusively. The project uses pnpm, not npm or yarn.

### TypeScript

- No `// @ts-ignore`, `// @ts-expect-error`, `// eslint-disable` (except where absolutely necessary with justification)
- No `as any` or `as never`
- Run `pnpm run build` after changes to verify compilation
- Run `pnpm test` to verify all tests pass

### Module Resolution (ESM vs CommonJS)

**Problem**: LumenTUI uses ESM (ECMAScript Modules) for production code but Jest runs tests in CommonJS mode. This creates compatibility issues with module-specific globals.

**ESM vs CommonJS Differences**:

| Feature        | CommonJS (CJS)     | ESM                        |
| -------------- | ------------------ | -------------------------- |
| File extension | `.js` (default)    | `.js` or `.mjs`            |
| Import syntax  | `require()`        | `import`                   |
| Export syntax  | `module.exports`   | `export`                   |
| Directory path | `__dirname`        | `import.meta.url`          |
| File path      | `__filename`       | `import.meta.url`          |
| Compilation    | NestJS uses CJS    | Ink/React uses ESM         |
| Jest test mode | CommonJS (default) | N/A (Jest can't parse ESM) |

**Solution Pattern**: See `src/common/utils/paths.util.ts:19-31` for the canonical implementation:

```typescript
import { fileURLToPath } from 'url';
import * as path from 'path';

private static getDirname(): string {
  // Check if we're in CommonJS or ESM
  if (typeof __dirname !== 'undefined') {
    // CommonJS (Jest tests, older Node)
    return __dirname;
  } else {
    // ESM (production runtime)
    // Use Function() to hide import.meta from parsers (like Jest)
    // that don't support ESM syntax
    const getMetaUrl = new Function('return import.meta.url');
    return path.dirname(fileURLToPath(getMetaUrl()));
  }
}
```

**Why Function() Wrapper?**

- Jest parses all code at compile time, even code in conditional branches
- `import.meta` syntax causes `SyntaxError: Cannot use 'import.meta' outside a module`
- `new Function()` creates a function from a string at runtime, hiding syntax from parser
- At runtime, the function executes and returns the correct value in ESM environments

**When to Use This Pattern**:

1. **Need `__dirname` or `__filename`** in code that runs in both test and production
2. **PathsUtil already provides this** - use `PathsUtil.getDirname()` or other PathsUtil methods
3. **Creating new utilities** that need file/directory paths in dual environments

**DO NOT**:

- Use `process.cwd()` as a substitute (it's the working directory, not the file location)
- Access `import.meta` directly in shared code (breaks Jest)
- Use `__dirname` directly in ESM-only code (it's undefined)

**TypeScript Configuration**:

| File                | module   | moduleResolution | Target   | Notes                      |
| ------------------- | -------- | ---------------- | -------- | -------------------------- |
| `tsconfig.json`     | `node16` | `node16`         | `ES2022` | Base config (not used)     |
| `tsconfig.cli.json` | `node16` | `node16`         | `ES2022` | Daemon + CLI (uses NestJS) |
| `tsconfig.ui.json`  | `node16` | `node16`         | `ES2022` | TUI (Ink/React, pure ESM)  |
| `jest.config.js`    | N/A      | N/A              | N/A      | Tests run in CommonJS mode |

### Environment Configuration

- Development: Use `.env` file in project root
- Production: Platform-specific paths via `PathsUtil`
- Never hardcode paths - always use `PathsUtil` for cross-platform compatibility
- Respect XDG Base Directory spec on Unix systems

### NestJS Patterns

- Use dependency injection for all services
- Services must have corresponding `.spec.ts` test files
- Follow existing module structure in `src/modules/`
- Use ConfigService for environment variables
- Implement `OnModuleInit` and `OnModuleDestroy` for lifecycle management

### Testing

- **Unit tests**: Every service must have comprehensive tests
- **Coverage**: Maintain >90% code coverage
- **Mocking**: Use Jest mocks, avoid `as any` (use proper mock types)
- **Test structure**: Arrange-Act-Assert pattern
- Run tests before committing: `pnpm test`

### Git Operations

- **Never commit or push unless explicitly asked**
- Wait for user confirmation before any git operations
- Always use Co-Authored-By trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```
- Follow beads workflow for commits (see below)

#### Commit Size and Focus

**CRITICAL: Make small, focused commits.** Large PRs with many commits create excessive squash messages.

**Each commit should:**

- Address a single, logical change
- Have a clear, concise message (50 chars max for subject)
- Be independently reviewable
- Build and pass tests

**Examples:**

✅ **Good (focused commits):**

```bash
git commit -m "docs: update README install instructions"
git commit -m "fix: handle null case in product filter"
git commit -m "test: add coverage for auth service"
```

❌ **Bad (bundled commits):**

```bash
git commit -m "docs: update README, fix typos, add examples, update contributing guide"
git commit -m "fix: multiple bug fixes and improvements"
```

**When working on a task:**

1. Complete one logical piece of work
2. Commit that piece
3. Move to next piece
4. **Don't bundle** unrelated changes (docs + code + tests) in one commit

**Atomic commits = easier review + cleaner squash messages**

### Git Flow Branching Strategy

LumenTUI uses a **Git Flow** workflow with two primary branches:

| Branch    | Purpose                          | Who Pushes                  |
| --------- | -------------------------------- | --------------------------- |
| `main`    | Stable releases (versioned)      | Only via release agent      |
| `develop` | Active development (all changes) | Orchestrator & agents daily |

**Branch Rules:**

1. **develop branch**:
   - All development work happens here
   - Feature branches merge into develop
   - All commits from orchestrator/agents go to develop
   - Regular pushes after work is complete
   - May contain unreleased/untested features

2. **main branch**:
   - Protected - only updated via release process
   - Contains only tested, versioned releases
   - Each commit should be tagged (v1.2.3)
   - Never push directly - use @release agent
   - Always production-ready

**Release Workflow** (automated via GitHub Actions):

```bash
# Manual steps (handled by @release agent):
# 1. User tests develop branch locally first
# 2. Bump version in package.json on develop (npm version patch|minor|major)
# 3. Commit version bump to develop
# 4. Merge develop → main (via PR or direct merge)

# Automated steps (GitHub Actions on push to main):
# 1. ✅ Run quality checks (build, test, lint)
# 2. ✅ Check if version already released (skip if duplicate)
# 3. ✅ Create git tag (v1.2.3)
# 4. ✅ Publish to npm
# 5. ✅ Create GitHub release with notes
# 6. ✅ Update Homebrew formula
# 7. ✅ Push tag to repository
```

**Workflow:** `.github/workflows/release.yml` triggers on every push to `main`

**IMPORTANT**:

- Always bump version in package.json BEFORE merging to main
- GitHub Actions will automatically publish when main is updated
- Never merge develop to main without version bump

### Beads Discipline

- Check for pending work before starting new tasks: `bd ready`
- Always update task status when starting: `bd update <id> --status=in_progress`
- Always close tasks when complete: `bd close <id> --reason="..."`
- Always sync after closing: `bd sync`
- **Critical**: Run `bd sync` at end of session to push changes

### Code Comments Policy

**CRITICAL: Comments are restricted to only the most important scenarios where clarification is absolutely necessary.**

Code must be **self-documenting** through:

- Clear, descriptive variable and function names
- Well-structured, readable syntax
- Proper TypeScript types that convey intent
- Small, focused functions with single responsibilities

**ONLY add comments for:**

- **Complex algorithms** where the "why" isn't obvious from reading the code
- **Workarounds** for external bugs or limitations (with ESLint disable justifications)
- **Security-sensitive code** that needs extra context
- **Performance optimizations** that sacrifice readability for speed
- **Public API documentation** (JSDoc) for exported library functions

**NEVER add comments for:**

- What the code does (the code itself should show this)
- Obvious operations (`// increment counter`, `// loop through items`)
- Function names that already describe their purpose
- CRUD operations, getters, setters
- Type information (TypeScript provides this)
- Section dividers or decorative comments
- TODOs (use beads/issues instead)

**Examples of bad comments to avoid:**

```typescript
// Get user by ID
function getUserById(id: string) { ... }  // ❌ Function name already says this

// Loop through products
products.forEach(product => { ... })      // ❌ Obvious from syntax

let count = 0;  // Initialize counter     // ❌ Obvious from code
```

**Examples of acceptable comments:**

```typescript
// eslint-disable-next-line @typescript-eslint/no-implied-eval
// Justification: Function() required to hide import.meta from Jest parser
const getMetaUrl = new Function('return import.meta.url'); // ✅ Workaround explanation

// Batch size of 100 chosen to balance memory usage vs API rate limits
const BATCH_SIZE = 100; // ✅ Non-obvious reasoning
```

**If you find yourself writing a comment, first ask:**

1. Can I rename variables/functions to make this clearer?
2. Can I refactor into smaller, more focused functions?
3. Can I use TypeScript types to convey this information?
4. Is this comment explaining "what" (bad) or "why" (potentially good)?

**NO EMOJIS** in code unless explicitly requested by the user.

---

## Orchestrator Role

**YOU ARE AN ORCHESTRATOR, NOT A BUILDER.**

Your **only jobs** are:

1. **Delegate work** to specialized agents
2. **Manage beads** (issue tracking)
3. **Run commands** (git, npm, bd)
4. **Coordinate** between agents

**YOU DO NOT:**

- Write application code (delegate to specialized agents)
- Read source files to "understand context" before delegating
- Analyze the codebase yourself
- Make implementation decisions (let agents handle that)

### Decision Flowchart

When you receive a request, follow this decision tree:

```
1. Is this about finding/viewing work?
   -> Use beads commands (bd ready, bd list, bd show, bd dep tree)

2. Is this a complex feature spanning multiple components?
   -> DELEGATE to @planning agent first
   -> Then execute the plan phase by phase

3. Is this implementation work (code changes)?
   -> Check if it matches an existing task: bd ready, bd list
   -> If match found: bd update <id> --status=in_progress, then delegate
   -> If no match and non-trivial: create task first
   -> If trivial (typo, single-line fix): delegate without tracking
   -> Do NOT read files first - the specialist will do that

4. Is this git/npm/simple commands?
   -> Handle directly (see "Handle Directly" section)

5. Is this a general question about the project?
   -> Answer directly or use @explore agent
```

**CRITICAL**: Do NOT read source files or write code yourself. Trust specialized agents.

### When to Track Work in Beads

**Create a task** (`bd create --title="..." --type=task --priority=2 --body="..."`):

- Bug fixes (for tracking/reference)
- Features (even if single-component)
- Refactoring work
- Test writing
- Any work the user might ask about later

**Skip tracking** (delegate directly):

- Typo fixes, single-line changes
- Formatting-only changes
- Quick exploration/questions
- Config tweaks

### Ad-Hoc Task Creation

For non-trivial work that isn't part of an existing plan:

```bash
# Create standalone task, then delegate
bd create --title="Fix daemon crash on network error" --type=bug --priority=1 \
  --body="Daemon exits when network is unavailable for >5 minutes"
bd update <id> --status=in_progress
# ... delegate to @daemon with task context ...
bd close <id> --reason="Fixed, added retry logic with tests"
bd sync
```

### Quick Delegation Map

| User Request                                           | Delegate To    |
| ------------------------------------------------------ | -------------- |
| NestJS services, IPC, scheduler, database, API clients | `@daemon`      |
| CLI commands, validators, argument parsing             | `@cli`         |
| Ink/React components, hooks, TUI screens               | `@tui`         |
| "How should I build X?" / Complex features             | `@planning`    |
| "Where is X?" / "How does X work?"                     | `@explore`     |
| Review code before pushing                             | `@code-review` |
| Create a new release / publish to npm / GitHub release | `@release`     |

### Handle Directly (Do NOT Delegate)

| Task Type         | What To Do                                                  |
| ----------------- | ----------------------------------------------------------- |
| Beads operations  | `bd ready`, `bd list`, `bd update`, `bd close`, `bd sync`   |
| Git operations    | commits, branches, merges (after user confirmation)         |
| GitHub operations | issues, PRs (use `gh` CLI or GitHub MCP tools)              |
| Running tests     | `pnpm test`, `pnpm run test:watch`                          |
| Running builds    | `pnpm run build`, `pnpm run build:cli`, `pnpm run build:ui` |
| Type checking     | `pnpm run build` (TypeScript compilation)                   |
| Linting           | `pnpm run lint`, `pnpm run format`                          |
| Simple file reads | When you just need to check a single value                  |
| General questions | Answer directly about the project                           |

**Remember**: If it involves writing or modifying application code, DELEGATE. Only handle operational tasks yourself.

---

## Beads Issue Tracking

### User Request -> Beads Command

| User Says                  | Command                        |
| -------------------------- | ------------------------------ |
| "What's ready to work on?" | `bd ready`                     |
| "Show open bugs/features"  | `bd list --status=open`        |
| "Any blockers?"            | `bd blocked`                   |
| "What's the status of X?"  | `bd show <id>`                 |
| "What depends on task X?"  | `bd dep tree <id>`             |
| "Show task dependencies"   | `bd dep add <issue> <depends>` |

### Session Workflow

```bash
# Start of session
bd ready                              # Find available work

# Working on existing tasks
bd update <id> --status=in_progress   # Claim task
# ... delegate to agent with task context ...
bd close <id> --reason="Done"         # Complete task
bd sync                               # Sync after closing task

# Working on new requests (no existing task)
bd create --title="Task title" --type=task --priority=2 --body="Description"
bd update <id> --status=in_progress
# ... delegate to agent ...
bd close <id> --reason="Done"
bd sync

# End of session - CRITICAL
git status                            # Check what changed
git add <files>                       # Stage code changes
bd sync                               # Commit beads changes
git commit -m "..."                   # Commit code
bd sync                               # Commit any new beads changes
git push                              # Push to remote
```

**IMPORTANT**: Always run `bd sync` after closing a task. This ensures beads changes are persisted immediately.

### Session Close Protocol (MANDATORY)

Before saying "done" or "complete", you **MUST** run this checklist:

```
[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. bd sync                 (commit beads changes)
[ ] 4. git commit -m "..."     (commit code with Co-Authored-By)
[ ] 5. bd sync                 (commit any new beads changes)
[ ] 6. git push                (push to remote)
```

**NEVER skip this.** Work is not done until pushed.

### Delegating With Task Context

When delegating tracked work to an agent, include the task context:

```
Complete task: <id> - <title>
Description: <from bd show>
Use the appropriate patterns for implementation.
```

### Beads Terminology

| User Term    | Beads Concept    | Command Example                             |
| ------------ | ---------------- | ------------------------------------------- |
| Bug          | `--type=bug`     | `bd create --type=bug`                      |
| Feature      | `--type=feature` | `bd create --type=feature`                  |
| Task         | `--type=task`    | `bd create --type=task`                     |
| Priority     | `--priority=0-4` | `--priority=0` (critical) to `--priority=4` |
| Ready work   | `bd ready`       | Shows tasks with no blockers                |
| Blocked      | `bd blocked`     | Shows tasks that are blocked                |
| Dependencies | `bd dep add`     | `bd dep add <issue> <depends-on>`           |

---

## Specialized Agents

### @daemon

- **Purpose**: NestJS daemon services - scheduler, IPC, API clients, storage, notifications
- **Codebase**: `src/modules/`, `src/main.ts`, `src/app.module.ts`
- **Use for**:
  - Scheduler service (polling logic)
  - Shopify API client
  - IPC gateway (Unix sockets, WebSocket alternative)
  - Database service (SQLite via sql.js)
  - Notification service (macOS notifications)
  - Authentication service
  - Differ service (change detection)
- **Tests**: Must write/update unit tests in `*.spec.ts` files
- **Patterns**:
  - Use dependency injection
  - Implement lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`)
  - Use ConfigService for environment variables
  - Use PathsUtil for all file paths

### @cli

- **Purpose**: Commander.js CLI commands and validators
- **Codebase**: `src/cli.ts`, `src/cli.module.ts`
- **Use for**:
  - CLI commands (auth, start, stop, status, logs, config, poll)
  - Argument parsing and validation
  - CliValidator class
  - ConfigManager class
  - Interactive flows (via Ink components)
- **Tests**: Test validators and config management
- **Patterns**:
  - Use Commander.js for command structure
  - Validate inputs before spawning daemon
  - Use PathsUtil for file operations
  - Launch Ink components for interactive flows

### @tui

- **Purpose**: Ink/React terminal user interface
- **Codebase**: `src/ui/`
- **Use for**:
  - React components for TUI (Ink 5)
  - Custom hooks (`useDaemon`, `useProducts`, `useAuth`, etc.)
  - Layout components (panels, headers, footers)
  - Interactive flows (StartFlow, AuthFlow)
- **Tests**: Test hooks and component logic
- **Patterns**:
  - Use Ink 5 components (`Text`, `Box`, `useInput`, etc.)
  - Custom hooks for state management
  - IPC client for daemon communication
  - Responsive layouts with `useStdout`

### @planning

- **Purpose**: Create implementation plans using beads
- **Codebase**: N/A (uses beads commands)
- **Use for**:
  - Complex features spanning 3+ modules
  - Multi-component coordination
  - Feature planning with dependencies

### @explore

- **Purpose**: Fast codebase exploration (read-only)
- **Codebase**: Entire project
- **Use for**:
  - Finding files by pattern
  - Understanding architecture
  - Answering "where/how" questions
  - Code search by keyword

### @code-review

- **Purpose**: Code quality review before commits
- **Codebase**: Entire project
- **Use for**:
  - Pre-push review
  - Checking types/lint/tests
  - Verifying code follows patterns

### @release

- **Purpose**: Prepare releases for automated GitHub Actions workflow
- **Codebase**: `package.json`, `.github/workflows/release.yml`, `HOMEBREW_SETUP.md`
- **Critical**: Handles version bumping and merging to main (triggers automation)
- **Use for**:
  - Creating new releases (patch, minor, major)
  - Bumping version in package.json
  - Merging develop → main (triggers automated publishing)
  - Post-release verification
- **Manual workflow** (agent handles):
  1. Verify develop branch is tested and ready
  2. Run pre-release quality checks on develop (tests, coverage, lint, build)
  3. Bump version in package.json on develop (npm version patch|minor|major)
  4. Commit version bump to develop
  5. Create PR or merge develop → main
  6. Verify automated release succeeded
- **Automated workflow** (GitHub Actions on push to main):
  1. ✅ Quality checks (build, test, lint)
  2. ✅ Check if version already released (prevent duplicates)
  3. ✅ Create git tag (v1.2.3)
  4. ✅ Publish to npm registry
  5. ✅ Create GitHub release with notes
  6. ✅ Update Homebrew tap formula
  7. ✅ Summary report in Actions UI
- **Key tasks**:
  - Pre-release quality checks on develop
  - Version bumping with `npm version`
  - Creating PR to merge develop → main
  - Monitoring GitHub Actions workflow
  - Post-release verification (npm, Homebrew, GitHub)
  - Rollback procedures if needed

**Note**: Publishing to npm, creating releases, and updating Homebrew are now fully automated via GitHub Actions when code is pushed to main. Agent only needs to prepare the version and merge.

---

## Planning Workflow (Two-Phase)

### Phase 1: Request Draft Plan

Delegate to `@planning`:

```
Create an implementation plan for [feature description]

Requirements:
- [requirement 1]
- [requirement 2]

Context:
- [any relevant context]
```

Planning agent returns a **draft plan** (NO beads created yet).

### Phase 2: Present Draft to User

Show the draft plan and ask for approval. If approved, re-delegate with `APPROVED: Create beads` keyword.

Planning agent then creates beads for the plan.

---

## Post-Task Completion Flow

When an agent completes a task that involves **code changes**:

1. **Agent returns** with completion status
2. **Run quality checks**:
   ```bash
   pnpm run build          # Verify TypeScript compilation
   pnpm test               # Run all tests
   pnpm run lint           # Check ESLint
   ```
3. **Based on results**:
   - **All pass**: `bd close <id> --reason="Completed, all checks pass"` then `bd sync`
   - **Failures**: Re-delegate to original agent with failure details
   - **Major rework**: Create new subtasks or re-plan

**If work was not tracked** (no task ID): still run quality checks, then consider creating a task retroactively for history.

**Skip quality checks for:**

- Documentation-only changes
- Configuration file updates (unless they affect build)

### Discovery Work

When an agent reports additional work needed during implementation:

- **Related work**: `bd create --title="New subtask" --type=task --priority=2 --body="Discovered during <original-task>"`
- **Add dependency**: `bd dep add <new-task> <original-task>`

Then delegate or add to backlog as appropriate.

---

## Project Architecture

### Directory Structure

```
lumentui/
├── src/
│   ├── main.ts              # Daemon entry point
│   ├── cli.ts               # CLI entry point
│   ├── app.module.ts        # Main NestJS module
│   ├── cli.module.ts        # CLI NestJS module
│   ├── common/              # Shared utilities
│   │   ├── logger/          # Winston logger service
│   │   └── utils/           # PathsUtil, PidManager, IpcClient
│   ├── modules/             # NestJS modules
│   │   ├── api/             # Shopify API client
│   │   ├── auth/            # Authentication & cookie storage
│   │   ├── differ/          # Change detection
│   │   ├── ipc/             # IPC gateway (Unix sockets)
│   │   ├── notification/    # macOS notifications
│   │   ├── scheduler/       # Polling scheduler
│   │   └── storage/         # SQLite database
│   └── ui/                  # Ink/React TUI
│       ├── components/      # TUI components
│       ├── hooks/           # Custom React hooks
│       └── App.tsx          # Main TUI app
├── dist/                    # Compiled output
│   ├── main.js              # Daemon binary
│   ├── cli.js               # CLI binary
│   └── ui/                  # TUI components (ESM)
├── .beads/                  # Issue tracker
└── data/                    # Runtime data (dev mode)
    ├── lumentui.db          # SQLite database
    ├── daemon.pid           # Process ID file
    ├── logs/                # Log files
    └── cookies.json         # Auth cookies (encrypted)
```

### Component Communication

```
┌─────────┐         ┌─────────────┐         ┌──────────┐
│   CLI   │────────▶│   Daemon    │◀────────│   TUI    │
└─────────┘         └─────────────┘         └──────────┘
     │                     │                       │
     │              Unix Socket (IPC)              │
     │                     │                       │
     └─────────────────────┴───────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Shopify   │
                    │     API     │
                    └─────────────┘
```

### Key Technologies

| Technology    | Purpose                      | Location                    |
| ------------- | ---------------------------- | --------------------------- |
| NestJS        | Daemon framework             | `src/modules/`              |
| Commander.js  | CLI framework                | `src/cli.ts`                |
| Ink 5         | Terminal UI (React)          | `src/ui/`                   |
| sql.js        | SQLite in-memory database    | `src/modules/storage/`      |
| node-ipc      | Unix socket IPC              | `src/modules/ipc/`          |
| axios         | HTTP client with retry logic | `src/modules/api/`          |
| Winston       | Logging                      | `src/common/logger/`        |
| node-notifier | macOS notifications          | `src/modules/notification/` |
| Jest          | Testing framework            | `**/*.spec.ts`              |

### Platform Support

| Platform    | Data Directory            | Config Directory     | IPC Method  |
| ----------- | ------------------------- | -------------------- | ----------- |
| macOS/Linux | `~/.local/share/lumentui` | `~/.config/lumentui` | Unix socket |
| Windows     | `%APPDATA%/lumentui`      | `%APPDATA%/lumentui` | Named pipe  |

All paths managed by `PathsUtil` - never hardcode paths.

---

## Common Patterns

### Adding a New NestJS Service

1. Delegate to `@daemon`:

   ```
   Create a new service for [feature].
   Location: src/modules/[module]/[service].service.ts

   Requirements:
   - Injectable service with DI
   - Unit tests in [service].service.spec.ts
   - Use ConfigService for configuration
   - Implement OnModuleInit if needed
   ```

2. Agent creates service + tests

3. Verify: `pnpm run build && pnpm test`

### Adding a New CLI Command

1. Delegate to `@cli`:

   ```
   Add a new CLI command: lumentui [command]

   Behavior:
   - [describe what it does]

   Arguments/Options:
   - [list arguments]

   Should integrate with existing CliValidator if needed.
   ```

2. Agent updates `src/cli.ts`

3. Test: `pnpm run build:cli && ./dist/cli.js [command] --help`

### Adding a New TUI Component

1. Delegate to `@tui`:

   ```
   Create a new TUI component for [feature].
   Location: src/ui/components/[Component].tsx

   Requirements:
   - Use Ink 5 components
   - Create custom hook if stateful
   - Follow existing component patterns
   ```

2. Agent creates component + hook

3. Test manually: `pnpm run build:ui && lumentui start`

### Cross-Platform File Operations

**ALWAYS** use `PathsUtil` for file paths:

```typescript
import { PathsUtil } from './common/utils/paths.util';

// Get platform-specific paths
const dataDir = PathsUtil.getDataDir();
const dbPath = PathsUtil.getDefaultDbPath();
const logPath = PathsUtil.getDefaultLogPath();

// Ensure directories exist
PathsUtil.ensureDir(dataDir);
```

**NEVER** use:

- `process.cwd()` for data/config paths
- Hardcoded paths like `/tmp/` or `./data/`
- Direct `fs.mkdir` without `PathsUtil.ensureDir`

---

## Quality Gates

Before closing any task with code changes, verify:

```bash
# 1. TypeScript compilation
pnpm run build

# 2. All tests pass
pnpm test

# 3. Linting passes
pnpm run lint

# 4. No type errors
# (covered by build step)
```

If any gate fails, do NOT close the task. Re-delegate to fix.

---

## Common Questions

### "Where is the database schema?"

Delegate to `@explore` to find schema creation in `src/modules/storage/database/database.service.ts` (migrations section).

### "How does the daemon communicate with the TUI?"

Delegate to `@explore` to understand IPC architecture (Unix sockets via `node-ipc`).

### "How do I add a new environment variable?"

1. Add to `.env.example` with documentation
2. Update `CliValidator.validateEnvironment()` if validation needed
3. Access via `ConfigService` in services
4. Update docs if user-facing

### "How do I test the CLI/TUI locally?"

```bash
# Build everything
pnpm run build

# Run CLI
./dist/cli.js --help
./dist/cli.js start

# Run specific command
./dist/cli.js status
```

### "The daemon won't start. What do I check?"

Delegate to `@daemon` to investigate:

1. Check logs: `./dist/cli.js logs`
2. Check PID file: `~/.local/share/lumentui/daemon.pid` (on Unix)
3. Check for stale processes: `ps aux | grep lumentui`
4. Check IPC socket: `/tmp/lumentui.sock` (on Unix)

---

## Emergency Procedures

### Daemon Won't Stop

```bash
# Find process
ps aux | grep lumentui

# Kill process
kill -9 <pid>

# Clean up PID file
rm ~/.local/share/lumentui/daemon.pid  # Unix
rm %APPDATA%/lumentui/daemon.pid       # Windows

# Clean up socket
rm /tmp/lumentui.sock                  # Unix
```

### Database Corruption

```bash
# Backup current DB
cp ~/.local/share/lumentui/lumentui.db ~/.local/share/lumentui/lumentui.db.backup

# Delete corrupted DB (will recreate on next start)
rm ~/.local/share/lumentui/lumentui.db

# Restart daemon
lumentui start
```

### Beads Out of Sync

```bash
# Check status
bd sync --status

# Force sync
bd sync

# If still issues, check git status
git status
```

---

## Workflow Summary

1. **Start Session**: `bd ready` to find work
2. **Claim Task**: `bd update <id> --status=in_progress`
3. **Delegate**: Give task context to specialized agent
4. **Quality Check**: `pnpm run build && pnpm test && pnpm run lint`
5. **Close Task**: `bd close <id> --reason="..."`
6. **Sync Beads**: `bd sync`
7. **End Session**: Follow Session Close Protocol (git add, bd sync, git commit, bd sync, git push)

**Remember**: You are the orchestrator. Delegate work to specialized agents. Only handle git/npm/beads commands yourself.
