# Contributing to Diligence Cubed

Thank you for your interest in contributing to Diligence Cubed! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, race, ethnicity, age, religion, or nationality.

### Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git
- A code editor (VS Code recommended)

### Initial Setup

1. **Fork the repository**

   Click the "Fork" button in the top right of the GitHub page.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/diligence-cubed.git
   cd diligence-cubed
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/your-org/diligence-cubed.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

6. **Verify setup**

   ```bash
   npm run build
   npm test
   ```

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clear, concise code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

Run the full test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Run type checking
npm run typecheck
```

### 4. Commit Your Changes

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
git commit -m "feat: add new financial analysis agent"
git commit -m "fix: resolve rate limiting issue in MCP manager"
git commit -m "docs: update API documentation"
```

Commit message format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Coding Standards

### TypeScript Style Guide

We follow the [Airbnb TypeScript Style Guide](https://github.com/airbnb/javascript) with some modifications.

#### File Structure

```typescript
// 1. Imports (external first, then internal)
import { Agent } from '@anthropic-ai/sdk';
import { MCPServerManager } from './mcp';

// 2. Type definitions
interface Config {
  apiKey: string;
  timeout: number;
}

// 3. Constants
const DEFAULT_TIMEOUT = 30000;

// 4. Main class/function
export class MyAgent extends BaseAgent {
  // ...
}

// 5. Helper functions
function helperFunction() {
  // ...
}
```

#### Naming Conventions

```typescript
// Classes: PascalCase
class DiligenceClient {}

// Interfaces: PascalCase
interface AgentConfig {}

// Functions: camelCase
function startDiligence() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private properties: _camelCase
class Agent {
  private _config: Config;
}

// File names: kebab-case
// financial-agent.ts, mcp-server-manager.ts
```

#### Code Style

```typescript
// Use const for variables that don't change
const apiKey = process.env.API_KEY;

// Use let for variables that change
let retryCount = 0;

// Prefer arrow functions for callbacks
array.map((item) => item.value);

// Use async/await instead of promises
async function fetchData() {
  const result = await apiCall();
  return result;
}

// Use template literals
const message = `Hello, ${name}!`;

// Use destructuring
const { name, age } = person;

// Use optional chaining
const value = obj?.deeply?.nested?.value;

// Use nullish coalescing
const timeout = config.timeout ?? DEFAULT_TIMEOUT;
```

### Documentation

All public APIs must be documented with JSDoc:

```typescript
/**
 * Starts a new due diligence analysis.
 *
 * @param options - Configuration options for the diligence
 * @param options.companyName - Name of the target company
 * @param options.companyDomain - Primary domain of the company
 * @param options.type - Type of diligence to perform
 * @param options.depth - Research depth level
 * @returns Promise resolving to the diligence result
 *
 * @example
 * ```typescript
 * const diligence = await client.startDiligence({
 *   companyName: 'Acme Corp',
 *   companyDomain: 'acme.com',
 *   type: 'full',
 *   depth: 'standard'
 * });
 * ```
 */
async startDiligence(options: DiligenceOptions): Promise<DiligenceResult> {
  // Implementation
}
```

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialAgent } from '../src/agents/financial-agent';

describe('FinancialAgent', () => {
  let agent: FinancialAgent;

  beforeEach(() => {
    agent = new FinancialAgent(mockConfig);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('analyzeRevenue', () => {
    it('should calculate revenue growth correctly', async () => {
      const result = await agent.analyzeRevenue(mockData);
      expect(result.growthRate).toBe(0.5);
    });

    it('should handle missing data gracefully', async () => {
      const result = await agent.analyzeRevenue({});
      expect(result.growthRate).toBeNull();
    });
  });
});
```

### Test Coverage

- Maintain minimum 80% code coverage
- All new features must include tests
- Bug fixes should include regression tests

```bash
npm run test:coverage
```

### Integration Tests

```typescript
describe('Integration: Full Diligence Workflow', () => {
  it('should complete a full diligence analysis', async () => {
    const client = new DiligenceClient(testConfig);

    const diligence = await client.startDiligence({
      companyName: 'Test Corp',
      companyDomain: 'test.com',
      type: 'full',
      depth: 'standard'
    });

    expect(diligence.id).toBeDefined();

    const report = await client.waitForCompletion(diligence.id);

    expect(report.executiveSummary).toBeDefined();
    expect(report.financialAnalysis).toBeDefined();
  }, 60000); // 60 second timeout
});
```

## Documentation

### Code Documentation

- All public APIs must have JSDoc comments
- Complex algorithms should have inline comments
- Update documentation when changing behavior

### README Updates

Update README.md when:
- Adding new features
- Changing installation process
- Modifying configuration options

### API Documentation

Update `docs/API.md` when:
- Adding new methods
- Changing method signatures
- Adding new types or interfaces

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**

   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

2. **Update documentation**

   - Update relevant documentation files
   - Add JSDoc comments for new APIs
   - Update CHANGELOG.md

3. **Rebase on latest main**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
Describe the tests you added or modified

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)
Add screenshots to help explain your changes
```

### Review Process

1. At least one maintainer must approve the PR
2. All automated checks must pass
3. Address all review comments
4. Maintainer will merge when ready

### After Merge

1. Delete your feature branch
2. Pull the latest main branch

```bash
git checkout main
git pull upstream main
git branch -d feature/your-feature-name
```

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **Major version** (1.0.0): Breaking changes
- **Minor version** (0.1.0): New features, backwards compatible
- **Patch version** (0.0.1): Bug fixes, backwards compatible

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Push to GitHub
5. Publish to npm

```bash
npm version minor
git push origin main --tags
npm publish
```

## Getting Help

### Resources

- [Documentation](docs/)
- [API Reference](docs/API.md)
- [Examples](docs/EXAMPLES.md)

### Contact

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion
- **Email**: dev@diligence-cubed.com

### Community

- **Discord**: Join our Discord server for real-time chat
- **Twitter**: Follow @diligence_cubed for updates

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Annual contributor spotlight

Thank you for contributing to Diligence Cubed!
