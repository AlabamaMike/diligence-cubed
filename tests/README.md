# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the Agentic Due Diligence Platform, including unit tests, integration tests, and end-to-end workflow tests.

## Test Structure

```
tests/
├── agents/              # Tests for individual agents
│   ├── orchestrator.test.ts
│   ├── financial.test.ts
│   ├── market.test.ts
│   └── competitive.test.ts
├── mcp/                 # MCP integration tests
│   ├── server-manager.test.ts
│   └── individual-clients.test.ts
├── orchestration/       # Workflow orchestration tests
│   ├── workflow.test.ts
│   └── parallel-execution.test.ts
├── integration/         # Integration tests
│   ├── end-to-end.test.ts
│   └── multi-agent.test.ts
├── unit/               # Unit tests
│   └── utilities.test.ts
├── helpers/            # Test utilities
│   ├── mocks.ts
│   └── test-utils.ts
├── fixtures/           # Test data
│   ├── company-data.ts
│   ├── mcp-responses.ts
│   └── agent-results.ts
├── setup.ts           # Global test setup
└── README.md          # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:unit           # Run unit tests only
npm run test:integration    # Run integration tests only
npm run test:agents         # Run agent tests only
npm run test:mcp            # Run MCP tests only
npm run test:orchestration  # Run orchestration tests only
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Verbose Output
```bash
npm run test:verbose
```

## Test Categories

### 1. Agent Tests (`tests/agents/`)

Tests for individual agent functionality:

- **Orchestrator Agent**: Planning, delegation, validation, gap identification
- **Financial Agent**: Revenue analysis, profitability, valuation, financial health
- **Market Agent**: Market sizing, growth drivers, industry structure
- **Competitive Agent**: Competitor mapping, positioning, moat assessment
- **Technical Agent**: Code quality, architecture, security assessment
- **Customer Agent**: Retention, acquisition, satisfaction metrics
- **Risk Agent**: Risk scoring, mitigation strategies

**Coverage Target**: >85%

### 2. MCP Integration Tests (`tests/mcp/`)

Tests for MCP server integration:

- **Server Manager**: Query handling, error management, retry logic
- **Caching**: Cache hits, expiration, invalidation
- **Rate Limiting**: Quota management, throttling
- **Error Handling**: Timeouts, auth errors, rate limits, network failures
- **Fallback Sources**: Primary and backup data sources

**Coverage Target**: >90%

### 3. Orchestration Tests (`tests/orchestration/`)

Tests for workflow coordination:

- **Workflow Execution**: Sequential and parallel stage execution
- **Task Scheduling**: Priority queuing, dependency resolution
- **Quality Gates**: Validation checkpoints, threshold enforcement
- **Error Recovery**: Retry logic, circuit breakers, graceful degradation
- **Resource Management**: Concurrency limits, load balancing

**Coverage Target**: >85%

### 4. Integration Tests (`tests/integration/`)

End-to-end workflow tests:

- **Full Diligence Workflow**: Complete execution from start to finish
- **Multi-Agent Coordination**: Data sharing, synchronization
- **Cross-Validation**: Data consistency across agents
- **Partial Failures**: Graceful handling of agent failures
- **Performance**: Load testing, scalability validation

**Coverage Target**: >75%

### 5. Unit Tests (`tests/unit/`)

Tests for utility functions:

- **Data Validation**: Input validation, constraint checking
- **Data Transformation**: Format conversion, calculations
- **Statistical Functions**: Mean, median, standard deviation, correlation
- **Error Handling**: Custom errors, sanitization
- **Caching Utilities**: Key generation, TTL management

**Coverage Target**: >90%

## Test Utilities

### Mock Objects

Located in `tests/helpers/mocks.ts`:

- **MockMCPServerManager**: Simulates MCP server responses
- **MockAgent**: Base agent implementation for testing
- **MockCache**: In-memory cache for testing
- **MockRateLimiter**: Rate limiting simulation
- **MockWorkflowContext**: Workflow state management

### Helper Functions

Located in `tests/helpers/test-utils.ts`:

- **createTestEnvironment()**: Sets up complete test environment
- **expectAsyncThrow()**: Assert async function throws
- **waitFor()**: Wait for condition with timeout
- **delay()**: Create delay for timing tests
- **TestLogger**: Capture and assert log output
- **PerformanceTracker**: Measure execution time

### Test Fixtures

Located in `tests/fixtures/`:

- **company-data.ts**: Mock company information
- **mcp-responses.ts**: Mock MCP server responses
- **agent-results.ts**: Mock agent execution results

## Custom Jest Matchers

Defined in `tests/setup.ts`:

- **toBeValidAgent()**: Validates agent structure
- **toHaveValidMCPResponse()**: Validates MCP response format
- **toBeWithinRange(floor, ceiling)**: Validates numeric range

## Writing New Tests

### Basic Test Structure

```typescript
import { createTestEnvironment } from '../helpers/test-utils';
import { mockCompanyBasicInfo } from '../fixtures/company-data';

describe('MyFeature', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('should do something', async () => {
    // Arrange
    const input = mockCompanyBasicInfo;

    // Act
    const result = await someFunction(input);

    // Assert
    expect(result).toBeDefined();
    expect(result.status).toBe('success');
  });
});
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it('should handle errors', async () => {
  await expect(
    asyncFunction()
  ).rejects.toThrow('Expected error message');
});
```

### Testing with Mocks

```typescript
it('should use mocked MCP server', async () => {
  testEnv.mcpManager.setResponse('alphavantage', mockResponse);

  const result = await testEnv.mcpManager.query('alphavantage', {});

  expect(result.status).toBe('success');
  expect(result.data).toBeDefined();
});
```

## Coverage Requirements

The test suite enforces the following coverage thresholds:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Coverage reports are generated in:
- `coverage/lcov-report/index.html` (HTML report)
- `coverage/lcov.info` (LCOV format)

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Dependencies**: Use mocks for MCP servers, databases, external APIs
3. **Clear Test Names**: Use descriptive names that explain what is being tested
4. **AAA Pattern**: Structure tests with Arrange, Act, Assert sections
5. **Test Edge Cases**: Include tests for error conditions and boundary cases
6. **Performance**: Keep tests fast (< 100ms per test when possible)
7. **Cleanup**: Always clean up resources in afterEach hooks

## CI/CD Integration

Tests are automatically run in the CI/CD pipeline:

- **On Pull Request**: All tests must pass
- **On Merge**: Full test suite with coverage report
- **Nightly**: Extended integration tests and performance benchmarks

## Debugging Tests

### Run Single Test File
```bash
npm test -- tests/agents/financial.test.ts
```

### Run Single Test
```bash
npm test -- -t "should analyze revenue metrics"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Maintenance

- Review and update fixtures regularly with current data formats
- Keep mocks in sync with actual API responses
- Update coverage thresholds as code quality improves
- Remove obsolete tests when features are deprecated
- Document complex test scenarios

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass before submitting PR
3. Add fixtures for new data structures
4. Update this README if adding new test categories
5. Maintain or improve coverage percentages

## Support

For questions or issues with tests:
- Check test output and error messages
- Review existing tests for similar patterns
- Consult the test utilities documentation
- Reach out to the testing team
