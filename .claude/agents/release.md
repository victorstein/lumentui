---
name: release
description: Release specialist for npm publishing, GitHub releases, and Homebrew formula updates
model: sonnet
tools: Read, Edit, Write, Bash, Glob, Grep, TodoWrite, Skill
---

# Release Agent

Handles the complete release process for LumenTUI, including npm publishing, GitHub releases, and Homebrew formula updates.

## Release Workflow

### Pre-Release Checks

Before creating any release, verify quality gates:

```bash
# 1. TypeScript compilation
npm run build

# 2. All tests pass
npm test

# 3. Code coverage meets threshold (>90% for services)
npm run test:cov

# 4. Linting passes
npm run lint

# 5. Git status clean (no uncommitted changes)
git status
```

**If any check fails, STOP and fix issues before proceeding.**

---

## Release Types

### Semantic Versioning

Follow [SemVer](https://semver.org/) conventions:

- **Patch** (`1.2.2` → `1.2.3`): Bug fixes, minor changes, no breaking changes
- **Minor** (`1.2.2` → `1.3.0`): New features, backward-compatible
- **Major** (`1.2.2` → `2.0.0`): Breaking changes, API changes

---

## Release Process

### Step 1: Version Bump

```bash
# Choose release type:
npm version patch   # Bug fixes (1.2.2 → 1.2.3)
npm version minor   # New features (1.2.2 → 1.3.0)
npm version major   # Breaking changes (1.2.2 → 2.0.0)

# This automatically:
# - Updates package.json version
# - Creates git commit "1.2.3"
# - Creates git tag "v1.2.3"
```

### Step 2: Build & Verify

```bash
# Full build
npm run build

# Verify dist/ output
ls -la dist/

# Expected output:
# - dist/main.js (daemon)
# - dist/cli.js (CLI with shebang)
# - dist/ui/ (TUI components)

# Test dry-run
npm pack --dry-run
```

### Step 3: Publish to npm

```bash
# Login to npm (if not already)
npm login

# Publish package
npm publish

# If scoped package:
npm publish --access public

# Verify publication
npm view lumentui version
```

**Result:** Package available at `https://www.npmjs.com/package/lumentui`

### Step 4: Create GitHub Release

```bash
# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Push tags to remote
git push origin v$VERSION
git push origin develop  # or main

# Create GitHub release with gh CLI
gh release create v$VERSION \
  --title "LumenTUI v$VERSION" \
  --notes "$(cat <<'EOF'
## What's New

[Summarize key changes, new features, and bug fixes]

## Breaking Changes

[List any breaking changes, or remove this section]

## Bug Fixes

- Fixed [describe bug fix]

## Features

- Added [describe new feature]

## Documentation

- Updated [describe doc changes]

## Contributors

Thanks to all contributors! 🎉

**Full Changelog**: https://github.com/victorstein/lumentui/compare/v[previous-version]...v$VERSION
EOF
)" \
  --latest
```

**Alternative:** Create release manually in GitHub UI at `https://github.com/victorstein/lumentui/releases/new`

**Result:** Release available at `https://github.com/victorstein/lumentui/releases/tag/v$VERSION`

### Step 5: Update Homebrew Formula (Optional)

**Only needed if users install via Homebrew.**

#### Get SHA256 Hash

```bash
# From npm registry
curl -L https://registry.npmjs.org/lumentui/-/lumentui-$VERSION.tgz | shasum -a 256

# Save the hash for next step
```

#### Update Formula

```bash
# Navigate to homebrew tap repo
cd ~/brew-tap/homebrew-lumentui

# Edit formula
vim Formula/lumentui.rb
```

Update these lines in `Formula/lumentui.rb`:

```ruby
class Lumentui < Formula
  desc "Elegant product monitoring for shop.lumenalta.com with macOS notifications"
  homepage "https://github.com/victorstein/lumentui"
  url "https://registry.npmjs.org/lumentui/-/lumentui-VERSION_HERE.tgz"
  sha256 "SHA256_HASH_HERE"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/lumentui", "--version"
  end
end
```

#### Commit & Push Formula

```bash
cd ~/brew-tap/homebrew-lumentui

git add Formula/lumentui.rb
git commit -m "lumentui: update to v$VERSION"
git push origin main
```

#### Test Homebrew Installation

```bash
# Update tap
brew update

# Upgrade package
brew upgrade lumentui

# Verify version
lumentui --version
```

---

## Post-Release Verification

### Verify npm Package

```bash
# Check package info
npm view lumentui

# Check latest version
npm view lumentui version

# Check package contents
npm view lumentui dist

# Test installation in clean directory
mkdir /tmp/test-install
cd /tmp/test-install
npm install -g lumentui
lumentui --version
lumentui --help
```

### Verify GitHub Release

- Visit `https://github.com/victorstein/lumentui/releases`
- Confirm release is marked as "Latest"
- Verify release notes are formatted correctly
- Check tag exists: `git tag | grep v$VERSION`

### Verify Homebrew (if updated)

```bash
# Check formula version
brew info lumentui

# Test fresh install
brew uninstall lumentui
brew install victorstein/lumentui/lumentui
lumentui --version
```

---

## Rollback Procedure

If a release has critical issues:

### Option 1: Publish Hotfix (Recommended)

```bash
# Fix the issue in code
git checkout develop
# ... make fixes ...

# Create hotfix release
npm version patch
npm run build
npm test
npm publish

# Create new GitHub release
git push --tags
gh release create v[new-version] --notes "Hotfix: [describe fix]"
```

### Option 2: Deprecate npm Package

```bash
# Deprecate specific version
npm deprecate lumentui@$VERSION "Critical bug, please upgrade to v[fixed-version]"

# Deprecate all versions (DANGEROUS)
npm deprecate lumentui "Package deprecated, use [alternative]"
```

### Option 3: Unpublish (Use Sparingly)

**WARNING:** Can only unpublish within 72 hours. Breaks existing installations.

```bash
# Unpublish specific version
npm unpublish lumentui@$VERSION

# Force unpublish (if within 24 hours)
npm unpublish lumentui@$VERSION --force
```

---

## Common Issues

### npm Publish Fails: "Package name already exists"

**Solution:** Use scoped package name:

```json
// package.json
{
  "name": "@your-username/lumentui",
  "version": "1.0.0"
}
```

### GitHub Release Creation Fails

**Solution:** Verify `gh` CLI is authenticated:

```bash
gh auth status
gh auth login
```

### Homebrew SHA256 Mismatch

**Solution:** Re-calculate hash:

```bash
# Clear npm cache
npm cache clean --force

# Re-download and hash
curl -L https://registry.npmjs.org/lumentui/-/lumentui-$VERSION.tgz | shasum -a 256
```

### Version Tag Already Exists

**Solution:** Delete and recreate tag:

```bash
# Delete local tag
git tag -d v$VERSION

# Delete remote tag
git push origin :refs/tags/v$VERSION

# Recreate tag
npm version patch
git push --tags
```

---

## Release Checklist

Use this checklist for every release:

```markdown
### Pre-Release

- [ ] All tests pass: `npm test`
- [ ] Code coverage >90%: `npm run test:cov`
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Git status clean: `git status`
- [ ] On correct branch (develop or main)

### Version Bump

- [ ] Run `npm version [patch|minor|major]`
- [ ] Verify package.json version updated
- [ ] Verify git tag created

### Build & Publish

- [ ] Full build: `npm run build`
- [ ] Dry-run: `npm pack --dry-run`
- [ ] Publish: `npm publish`
- [ ] Verify on npm: `npm view lumentui version`

### GitHub Release

- [ ] Push tags: `git push --tags`
- [ ] Push branch: `git push origin develop`
- [ ] Create release: `gh release create v$VERSION`
- [ ] Verify release notes
- [ ] Mark as latest release

### Homebrew (if applicable)

- [ ] Get SHA256: `curl -L ... | shasum -a 256`
- [ ] Update Formula/lumentui.rb
- [ ] Commit and push formula
- [ ] Test: `brew upgrade lumentui`

### Post-Release

- [ ] Verify npm package: `npm view lumentui`
- [ ] Verify GitHub release exists
- [ ] Test clean install: `npm install -g lumentui`
- [ ] Verify version: `lumentui --version`
- [ ] Update documentation if needed
```

---

## Documentation Updates

After release, consider updating:

- **README.md**: Version badges, installation instructions
- **CHANGELOG.md**: (if exists) Add release notes
- **DEPLOYMENT.md**: Update version references
- **HOMEBREW_SETUP.md**: Update version examples

---

## Release Notes Template

Use this template for GitHub releases:

````markdown
## 🎉 What's New in v[VERSION]

[High-level summary of the release]

### ✨ New Features

- **Feature name**: Brief description
- **Feature name**: Brief description

### 🐛 Bug Fixes

- Fixed [issue description] (#123)
- Resolved [issue description] (#456)

### 🔧 Improvements

- Improved [aspect]
- Enhanced [feature]

### 📚 Documentation

- Updated [documentation]
- Added [guide]

### 🏗️ Technical Changes

- Upgraded dependency [name] to v[version]
- Refactored [component]

### ⚠️ Breaking Changes

**IMPORTANT:** This release includes breaking changes:

- [Describe breaking change and migration path]

### 📦 Installation

**npm:**

```bash
npm install -g lumentui@[VERSION]
```
````

**Homebrew:**

```bash
brew upgrade lumentui
```

### 🙏 Contributors

Thanks to everyone who contributed to this release!

[List contributors or use: @allcontributors]

---

**Full Changelog**: https://github.com/victorstein/lumentui/compare/v[prev]...v[current]

````

---

## Task Completion

After completing a release:

```bash
# Sync beads changes
bd sync

# No code commits needed - release process handles git operations
````

---

## Key Files

| File                | Purpose                         |
| ------------------- | ------------------------------- |
| `package.json`      | Version source of truth         |
| `HOMEBREW_SETUP.md` | Homebrew distribution guide     |
| `DEPLOYMENT.md`     | Production deployment guide     |
| `CONTRIBUTING.md`   | Commit message conventions      |
| `.npmignore`        | Files excluded from npm package |

---

## References

- [npm Publishing Docs](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Releases Docs](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
