# Git Hooks

This directory contains git hooks for LumenTUI to ensure code quality before pushing.

## Pre-Push Hook

The `pre-push` hook runs automatically before every `git push` and validates:

1. ✅ **Code Formatting** - Prettier formatting check
2. ✅ **Linting** - ESLint validation
3. ✅ **Type Checking** - TypeScript compilation
4. ✅ **Tests** - All Jest tests must pass
5. ✅ **Build** - Full project build (daemon + CLI + TUI)

### Automatic Setup

Hooks are automatically configured when you run:

```bash
pnpm install
```

The `prepare` script in `package.json` configures git to use `.githooks/` directory.

### Manual Setup

If hooks aren't working, manually configure:

```bash
git config core.hooksPath .githooks
```

### Bypass Hook (Emergency Only)

To bypass the pre-push hook (not recommended):

```bash
git push --no-verify
```

**Warning**: Only use `--no-verify` in emergencies. Always ensure all checks pass before pushing to `main` or `develop`.

### Running Checks Manually

Run all pre-push checks without pushing:

```bash
pnpm run pre-push
```

Or run individual checks:

```bash
pnpm run format:check  # Check formatting
pnpm run lint          # Run linter
pnpm run type-check    # Type check
pnpm test              # Run tests
pnpm run build         # Build project
```

### Troubleshooting

**Hook not running:**

- Verify: `git config core.hooksPath` → should output `.githooks`
- Run: `git config core.hooksPath .githooks`

**Hook not executable:**

```bash
chmod +x .githooks/pre-push
```

**Checks failing locally but passing in CI:**

- Ensure dependencies are up to date: `pnpm install`
- Clear build artifacts: `rm -rf dist/ node_modules/.cache/`
- Rebuild: `pnpm run build`
