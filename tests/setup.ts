/**
 * Jest test setup file
 */

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error'; // Reduce log noise during tests
process.env['ANTHROPIC_API_KEY'] = 'test-api-key';

// Mock external services in tests by default
jest.mock('../src/mcp/MCPServerManager');

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
