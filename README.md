# Diligence Cubed - Agentic Due Diligence Platform

An autonomous due diligence research platform leveraging Claude Agents SDK and MCP servers to perform comprehensive commercial, financial, and technical analysis of target companies.

## Overview

Diligence Cubed automates the due diligence process using a multi-agent architecture, reducing initial diligence time from weeks to hours while maintaining depth and consistency.

## Features

- **Multi-Agent Orchestration**: Specialized agents for financial, market, competitive, technical, and risk analysis
- **MCP Server Integration**: Seamless integration with AlphaVantage, Exa.ai, Perplexity, GitHub, and more
- **Adaptive Research Depth**: Dynamically adjusts analysis depth based on risk signals
- **Cross-Validation**: Multi-source verification for accuracy
- **Comprehensive Reporting**: Investment memos, risk assessments, and interactive dashboards

## Project Structure

```
diligence-cubed/
├── src/
│   ├── agents/              # Agent implementations
│   │   ├── BaseAgent.ts
│   │   └── OrchestratorAgent.ts
│   ├── mcp/                 # MCP server integrations
│   │   └── MCPServerManager.ts
│   ├── orchestration/       # Workflow orchestration
│   │   └── DiligencePlatform.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── agents.ts
│   │   ├── diligence.ts
│   │   ├── mcp.ts
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   ├── logger.ts
│   │   └── errors.ts
│   ├── config/             # Configuration management
│   │   └── index.ts
│   └── index.ts            # Main entry point
├── tests/                  # Test files
│   ├── setup.ts
│   └── example.test.ts
├── docs/                   # Documentation
├── logs/                   # Log files
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- API keys for MCP servers (see `.env.example`)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd diligence-cubed
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Build the project:
   ```bash
   npm run build
   ```

### Usage

```typescript
import DiligenceCubed from 'diligence-cubed';

// Initialize the platform
const platform = new DiligenceCubed();

// Start a due diligence project
const diligenceId = await platform.startDiligence('Target Company Inc', {
  companyDomain: 'targetcompany.com',
  scope: 'full',
  depth: 'standard',
  priority: 'normal'
});

// Check status
const status = await platform.getStatus(diligenceId);
console.log(`Progress: ${status.progress}%`);

// Get results
const results = await platform.getResults(diligenceId);
```

## Development

### Available Scripts

- `npm run dev` - Run in development mode with watch
- `npm run build` - Build the project
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Lint the code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Configuration

The platform uses environment variables for configuration. Copy `.env.example` to `.env` and configure:

- **ANTHROPIC_API_KEY**: Your Anthropic API key (required)
- **ALPHAVANTAGE_API_KEY**: AlphaVantage API key for financial data
- **EXA_API_KEY**: Exa.ai API key for deep web search
- **GITHUB_TOKEN**: GitHub token for code analysis
- Additional MCP server API keys as needed

## Architecture

The platform uses a multi-agent architecture where:

1. **Orchestrator Agent** coordinates the overall workflow
2. **Specialized Agents** perform domain-specific analysis:
   - Financial Analysis Agent
   - Market & Industry Agent
   - Competitive Intelligence Agent
   - Product & Technology Agent
   - Customer & Revenue Agent
   - News & Sentiment Agent
   - Risk Assessment Agent
   - Synthesis & Reporting Agent

3. **MCP Integration Layer** provides unified access to external data sources

## Documentation

See the `docs/` directory for detailed documentation:
- Architecture overview
- Agent specifications
- API reference
- Integration guides

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
