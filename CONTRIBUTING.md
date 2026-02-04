# 🤝 Contributing to LumentuiAPI

Thank you for considering contributing to LumentuiAPI! This document provides guidelines for contributing to the project.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Code Style](#code-style)
5. [Testing Guidelines](#testing-guidelines)
6. [Commit Messages](#commit-messages)
7. [Pull Request Process](#pull-request-process)
8. [Issue Reporting](#issue-reporting)
9. [Architecture Guidelines](#architecture-guidelines)

---

## 🤝 Code of Conduct

### Our Standards

- **Be respectful** and considerate in all communications
- **Be collaborative** and open to feedback
- **Focus on what is best** for the project and community
- **Show empathy** towards other community members

---

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18.x or higher
- pnpm 8.x or higher (package manager - **NOT npm or yarn**)
- macOS (for Chrome Keychain features and notifications)
- Chrome browser
- Git configured with your name and email
- Familiarity with TypeScript, NestJS, and Ink (React for CLI)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/lumentui.git
cd lumentui
```

3. Add upstream remote:

```bash
git remote add upstream https://github.com/victorstein/lumentui.git
```

4. Create a feature branch from **develop**:

```bash
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

### Branching Strategy

LumenTUI uses **Git Flow** workflow with two primary branches:

| Branch    | Purpose                                   | Protected |
| --------- | ----------------------------------------- | --------- |
| `main`    | Stable releases only (versioned, tagged)  | ✅ Yes    |
| `develop` | Active development (all feature branches) | ⚠️ No     |

**Important Rules:**

1. **All development happens on `develop`**
   - Create feature branches from `develop`
   - Submit pull requests to `develop` (NOT `main`)
   - `develop` may contain unreleased/untested features

2. **`main` is protected**
   - Contains only tested, production-ready releases
   - Each commit is tagged with a version (e.g., `v1.2.3`)
   - Only updated during release process by maintainers
   - Never submit PRs directly to `main`

3. **Feature branch workflow:**

```bash
# Start new feature
git checkout develop
git pull upstream develop
git checkout -b feature/my-new-feature

# Work on your feature
git add .
git commit -m "feat: add new feature"

# Keep your branch up to date
git fetch upstream
git rebase upstream/develop

# Push to your fork
git push origin feature/my-new-feature

# Submit PR to upstream/develop (NOT main)
```

4. **Release workflow** (maintainers only):
   - Test features on `develop` branch
   - When ready, merge `develop` → `main`
   - Tag release with version (v1.2.3)
   - Publish to npm
   - Create GitHub release

**Branch Naming Conventions:**

- Features: `feature/description` (e.g., `feature/notification-history`)
- Bug fixes: `fix/description` (e.g., `fix/connection-timeout`)
- Documentation: `docs/description` (e.g., `docs/update-readme`)
- Refactoring: `refactor/description` (e.g., `refactor/cleanup-auth`)

---

## 💻 Development Setup

### Install Dependencies

```bash
pnpm install
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run in Development Mode

```bash
# Start daemon in development mode
pnpm run start:dev

# Or start with TUI
pnpm run build
./dist/cli.js start
```

### Run Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:cov
```

---

## 🎨 Code Style

### TypeScript Style Guide

We follow standard TypeScript/NestJS conventions:

#### Naming Conventions

```typescript
// Classes: PascalCase
class ShopifyService {}

// Interfaces: PascalCase with 'I' prefix (optional)
interface IProduct {}
interface Product {} // Also acceptable

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Variables and functions: camelCase
const productList = [];
function fetchProducts() {}

// Private members: prefix with underscore
private _cachedData: any;

// Files: kebab-case
auth.service.ts
shopify-api.helper.ts
```

#### Code Formatting

**Use Prettier** for automatic formatting:

```bash
pnpm run format
```

**Prettier Configuration** (`.prettierrc`):

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "tabWidth": 2,
  "printWidth": 80
}
```

#### ESLint Rules

**Run linter** before committing:

```bash
pnpm run lint
```

**Key rules:**

- No unused variables
- No any types (use unknown or proper types)
- Explicit return types for public methods
- Use async/await over promises
- No console.log (use Logger)

#### Import Organization

```typescript
// 1. Node built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External dependencies
import { Injectable } from '@nestjs/common';
import axios from 'axios';

// 3. Internal modules
import { DatabaseService } from '../storage/database.service';
import { Product } from './interfaces/product.interface';

// 4. Relative imports
import { normalizeProduct } from './utils/normalizer';
```

---

## 🧪 Testing Guidelines

### Test Structure

Follow AAA pattern (Arrange, Act, Assert):

```typescript
describe('ShopifyService', () => {
  let service: ShopifyService;
  let httpService: HttpService;

  beforeEach(async () => {
    // Arrange: Set up test environment
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
  });

  describe('fetchProducts', () => {
    it('should fetch products successfully', async () => {
      // Arrange
      const mockData = { products: [] };
      jest.spyOn(httpService, 'get').mockResolvedValue(mockData);

      // Act
      const result = await service.fetchProducts();

      // Assert
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Coverage Requirements

| Module Type     | Minimum Coverage |
| --------------- | ---------------- |
| **Services**    | 90%              |
| **Controllers** | 80%              |
| **Utilities**   | 95%              |
| **Overall**     | 85%              |

### Test Naming

```typescript
// ✅ Good
it('should return products when API call succeeds');
it('should throw ShopifyApiException when API returns 500');
it('should retry 3 times before failing');

// ❌ Bad
it('works');
it('test1');
it('handles error');
```

### Mock Data

Create reusable mocks in `test/mocks/`:

```typescript
// test/mocks/product.mock.ts
export const mockProduct: Product = {
  id: 'test-123',
  handle: 'test-product',
  title: 'Test Product',
  // ...
};
```

### Integration Tests

Place integration tests in `test/` directory:

```typescript
// test/auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth (GET)', () => {
    return request(app.getHttpServer()).get('/auth').expect(200);
  });
});
```

---

## 📝 Commit Messages

### Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples:**

```bash
# Feature
git commit -m "feat(auth): add Chrome cookie extraction"

# Bug fix
git commit -m "fix(api): handle 429 rate limit errors"

# Documentation
git commit -m "docs(readme): update installation instructions"

# With body and footer
git commit -m "feat(notification): add macOS notification integration

Integrated node-notifier for macOS native notifications.
Includes rate limiting (1 notification per hour per product).

Closes #42"
```

### Commit Best Practices

**IMPORTANT: Make small, focused commits.** When PRs have many large commits, squashing creates excessive commit messages that are difficult to manage.

#### Commit Size Guidelines

**Each commit should:**

- Address a **single, logical change**
- Have a clear, concise subject line (max 50 characters)
- Be independently reviewable
- Build and pass all tests

**Think atomic:** One commit = one unit of work

✅ **Good (focused commits):**

```bash
git commit -m "docs: update README install instructions"
git commit -m "fix: handle null case in product filter"
git commit -m "test: add coverage for auth service"
git commit -m "refactor: extract validation logic to helper"
```

❌ **Bad (bundled commits):**

```bash
git commit -m "docs: update README, fix typos, add examples, update contributing guide"
git commit -m "fix: multiple bug fixes and improvements"
git commit -m "feat: add feature + tests + docs + refactoring"
```

#### General Best Practices

✅ **Do:**

- Write clear, descriptive commit messages
- **Keep commits focused** (one logical change per commit)
- Reference issues in commit messages (`Closes #42`)
- Use present tense ("add feature" not "added feature")
- Separate concerns: code changes, tests, and docs can be separate commits

❌ **Don't:**

- Commit commented-out code
- **Bundle unrelated changes** (docs + code + tests) in one commit
- Use vague messages ("fix stuff", "update code")
- Commit secrets or sensitive data
- Create commits with multiple unrelated file changes

#### Why Small Commits Matter

When maintainers squash your PR, all commit messages combine into one. Large commits with many changes create unwieldy squash messages:

```bash
# ❌ Bad: One large commit = one large squash message
feat: add notification system, update docs, refactor auth, add tests

# ✅ Good: Multiple small commits = clean squash
feat: add notification service
feat: add notification rate limiting
test: add notification service tests
docs: document notification configuration
```

**Atomic commits = easier review + cleaner history + better squash messages**

---

## 🔄 Pull Request Process

### Before Submitting

1. **Update your branch with latest develop:**

```bash
git fetch upstream
git rebase upstream/develop
```

> **Note:** Always rebase against `develop`, not `main`

2. **Run all tests:**

```bash
pnpm test
pnpm run test:cov
pnpm run lint
pnpm run build  # Verify TypeScript compilation
```

3. **Update documentation:**

- Update README.md if adding features
- Add JSDoc comments for new public functions/classes
- Update CHANGELOG.md

4. **Test locally:**

```bash
pnpm run build
./dist/cli.js start  # Test TUI
./dist/cli.js --help  # Test CLI commands
```

### PR Title

Follow Conventional Commits format:

```
feat(module): add new functionality
fix(service): resolve connection timeout
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist

- [ ] My code follows the project's code style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Related Issues

Closes #(issue number)
```

### Review Process

1. **Automated checks** must pass:
   - All tests passing
   - Linter passing
   - Coverage threshold met

2. **Code review** by maintainer:
   - Code quality
   - Test coverage
   - Documentation
   - Breaking changes

3. **Address feedback:**
   - Make requested changes
   - Reply to comments
   - Push additional commits

4. **Merge:**
   - Squash and merge (default)
   - Rebase and merge (for clean history)

---

## 🐛 Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Run command '...'
2. See error '...'

**Expected behavior**
What you expected to happen.

**Environment:**

- OS: [e.g. macOS 13.0]
- Node.js version: [e.g. 18.17.0]
- LumentuiAPI version: [e.g. 1.0.0]

**Logs**
```

Paste relevant logs here

```

**Additional context**
Add any other context about the problem here.
```

### Feature Requests

```markdown
**Is your feature request related to a problem?**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

---

## 🏗️ Architecture Guidelines

### NestJS Module Structure

```
modules/
  feature/
    ├── feature.module.ts      # Module definition
    ├── feature.service.ts     # Business logic
    ├── feature.controller.ts  # HTTP endpoints (if needed)
    ├── dto/                   # Data Transfer Objects
    ├── entities/              # Database entities
    ├── interfaces/            # TypeScript interfaces
    ├── exceptions/            # Custom exceptions
    ├── utils/                 # Helper functions
    └── __tests__/             # Tests
        ├── feature.service.spec.ts
        └── feature.controller.spec.ts
```

### Dependency Injection

Always use constructor injection:

```typescript
@Injectable()
export class ShopifyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: Logger,
    @Inject(CONFIG_OPTIONS) private readonly config: ConfigType,
  ) {}
}
```

### Error Handling

Create custom exceptions:

```typescript
// modules/api/exceptions/shopify-api.exception.ts
export class ShopifyApiException extends HttpException {
  constructor(message: string, status: HttpStatus) {
    super(message, status);
  }
}

// Usage in service
throw new ShopifyApiException('API request failed', HttpStatus.BAD_GATEWAY);
```

### Logging

Use Winston logger:

```typescript
import { Logger } from 'winston';

@Injectable()
export class MyService {
  constructor(@Inject('winston') private readonly logger: Logger) {}

  async doSomething() {
    this.logger.info('Starting operation', { context: 'MyService' });

    try {
      // Operation
      this.logger.debug('Operation successful', { result });
    } catch (error) {
      this.logger.error('Operation failed', { error: error.message });
      throw error;
    }
  }
}
```

### Configuration

Use ConfigModule:

```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
}),

// In service
constructor(private configService: ConfigService) {}

const apiUrl = this.configService.get<string>('API_URL');
```

---

## 🎓 Learning Resources

### NestJS

- [Official Documentation](https://docs.nestjs.com/)
- [NestJS Fundamentals Course](https://courses.nestjs.com/)

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Testing

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing NestJS Applications](https://docs.nestjs.com/fundamentals/testing)

---

## ❓ Questions?

- Open an issue with the `question` label
- Reach out to maintainers: stein.hakase.vs@gmail.com
- Check existing documentation in `docs/`

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's license.

---

**Thank you for contributing to LumentuiAPI! 🎉**
