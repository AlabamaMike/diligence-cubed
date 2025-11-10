# Changelog

All notable changes to Diligence Cubed will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Real-time monitoring dashboard
- Custom agent creation framework
- Multi-language support
- Excel/PowerBI export formats
- Self-improving agents with feedback loops

## [1.0.0] - 2025-11-10

### Added
- **Core Platform**
  - Multi-agent orchestration system with Claude Agents SDK
  - Nine specialized agents for comprehensive due diligence:
    - Orchestrator Agent: Master coordinator
    - Financial Analysis Agent: Revenue, valuation, unit economics
    - Market & Industry Agent: TAM/SAM/SOM, growth drivers
    - Competitive Intelligence Agent: Positioning, moat assessment
    - Product & Technology Agent: Architecture, code quality
    - Customer & Revenue Agent: Retention, sales efficiency
    - News & Sentiment Agent: Monitoring, sentiment analysis
    - Risk Assessment Agent: Multi-dimensional risk scoring
    - Synthesis & Reporting Agent: Report generation

- **MCP Server Integration**
  - AlphaVantage integration for financial fundamentals
  - Exa.ai integration for deep web search
  - Perplexity integration for real-time search
  - GitHub integration for code repository analysis
  - NewsAPI integration for news monitoring
  - Polygon.io integration for market data
  - Unified MCP server manager with rate limiting
  - Multi-level caching (memory, Redis)
  - Automatic fallback handling
  - Request queuing and prioritization

- **API Layer**
  - RESTful API with comprehensive endpoints
  - WebSocket support for real-time updates
  - Webhook integration for event notifications
  - Client SDK for TypeScript/JavaScript
  - CLI tool for command-line usage
  - API key authentication
  - Rate limiting and quota management

- **Research Capabilities**
  - Adaptive research depth (standard, deep, exhaustive)
  - Parallel agent execution for speed
  - Cross-validation across multiple data sources
  - Automatic gap identification and follow-up
  - Custom agent configuration per diligence
  - Focus area specification
  - Priority-based scheduling

- **Reporting**
  - JSON report format with structured data
  - PDF investment memo generation
  - Excel export for financial models
  - Executive summary with recommendations
  - Red flag identification and severity scoring
  - Source attribution and confidence scores
  - Comparative analysis across companies

- **Infrastructure**
  - TypeScript codebase with strict typing
  - Comprehensive error handling
  - Structured logging with Winston
  - Configuration management
  - Environment variable support
  - Docker containerization support
  - PostgreSQL for data persistence
  - Redis for caching and rate limiting

- **Developer Experience**
  - Comprehensive API documentation
  - Architecture documentation
  - MCP integration guide
  - Usage examples and cookbook
  - Contributing guidelines
  - TypeScript type definitions
  - ESLint and Prettier configuration
  - Automated testing with Vitest
  - CI/CD pipeline with GitHub Actions

- **Documentation**
  - README with quick start guide
  - API reference documentation
  - Architecture overview
  - MCP server setup guides
  - Code examples and patterns
  - Troubleshooting guides
  - Best practices

### Security
- API key-based authentication
- Environment variable configuration
- Secure MCP server credential storage
- Input validation and sanitization
- Rate limiting to prevent abuse
- Error messages without sensitive data
- Audit logging for compliance

### Performance
- Parallel agent execution
- Multi-level caching strategy
- Connection pooling for databases
- Request batching for APIs
- Lazy loading of data
- Response streaming for large reports
- Cache hit rate optimization

## [0.9.0] - 2025-10-15 (Beta)

### Added
- Beta release with core functionality
- Basic agent implementation
- MCP server integration
- Simple reporting

### Changed
- Improved error handling
- Enhanced logging

### Fixed
- Rate limiting bugs
- Cache invalidation issues

## [0.5.0] - 2025-09-01 (Alpha)

### Added
- Alpha release for testing
- Orchestrator agent
- Financial agent
- Basic MCP integration

### Known Issues
- Limited error recovery
- Basic reporting only
- Single-threaded execution

## Version Comparison

| Version | Release Date | Key Features | Status |
|---------|-------------|--------------|--------|
| 1.0.0 | 2025-11-10 | Full platform, 9 agents, MCP integration | Current |
| 0.9.0 | 2025-10-15 | Beta release, core functionality | Deprecated |
| 0.5.0 | 2025-09-01 | Alpha release, basic agents | Deprecated |

## Migration Guides

### Migrating from 0.9.0 to 1.0.0

#### Breaking Changes

1. **API Changes**
   ```typescript
   // Old (0.9.0)
   const result = await client.analyze('Company Name', { depth: 'high' });

   // New (1.0.0)
   const result = await client.startDiligence({
     companyName: 'Company Name',
     companyDomain: 'company.com',
     type: 'full',
     depth: 'deep'  // Changed from 'high' to 'deep'
   });
   ```

2. **Configuration Structure**
   ```typescript
   // Old (0.9.0)
   const client = new DiligenceClient({
     key: 'api-key',
     servers: { alphavantage: 'key' }
   });

   // New (1.0.0)
   const client = new DiligenceClient({
     apiKey: 'api-key',  // Changed from 'key' to 'apiKey'
     mcpServers: { alphavantage: 'key' }  // Changed from 'servers' to 'mcpServers'
   });
   ```

3. **Report Structure**
   - `analysis` renamed to `financialAnalysis`
   - `marketInfo` renamed to `marketAnalysis`
   - Added `riskAssessment` section
   - Added `executiveSummary` section

#### New Features
- WebSocket support for real-time updates
- Webhook integration
- Custom agent configuration
- Priority-based scheduling
- Excel export format

## Release Process

### How Releases Work

1. **Version Bump**: Update version in `package.json`
2. **Update Changelog**: Add new entries under `[Unreleased]`
3. **Tag Release**: Create git tag with version number
4. **Publish**: Publish to npm registry
5. **Deploy**: Update production infrastructure

### Release Schedule

- **Major releases**: Annually (January)
- **Minor releases**: Quarterly (April, July, October, January)
- **Patch releases**: As needed for critical bug fixes

### Support Policy

- **Current major version**: Full support (1.x.x)
- **Previous major version**: Security updates for 12 months
- **Older versions**: No support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Reporting bugs
- Suggesting enhancements
- Submitting pull requests
- Development workflow

## Links

- [Homepage](https://diligence-cubed.com)
- [Documentation](https://docs.diligence-cubed.com)
- [API Reference](https://api.diligence-cubed.com/docs)
- [GitHub Repository](https://github.com/your-org/diligence-cubed)
- [npm Package](https://www.npmjs.com/package/diligence-cubed)
- [Issue Tracker](https://github.com/your-org/diligence-cubed/issues)

## Acknowledgments

Special thanks to:
- Anthropic for the Claude Agents SDK
- All contributors and early adopters
- The open-source community

---

For questions about releases, contact: releases@diligence-cubed.com
