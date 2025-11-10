# System Architecture

This document describes the high-level architecture of Diligence Cubed, including component interactions, data flows, and technology stack.

## Table of Contents

- [Overview](#overview)
- [Architecture Layers](#architecture-layers)
- [Component Interactions](#component-interactions)
- [Data Flow](#data-flow)
- [Agent System](#agent-system)
- [MCP Integration Layer](#mcp-integration-layer)
- [Storage and Caching](#storage-and-caching)
- [Security Architecture](#security-architecture)
- [Scalability and Performance](#scalability-and-performance)
- [Technology Stack](#technology-stack)

## Overview

Diligence Cubed is built as a multi-layer, event-driven system that orchestrates multiple specialized AI agents to perform comprehensive due diligence analysis. The architecture is designed for:

- **Modularity**: Each agent operates independently with clear interfaces
- **Scalability**: Horizontal scaling of agents and services
- **Reliability**: Fault tolerance with fallbacks and retries
- **Performance**: Parallel processing and intelligent caching
- **Security**: End-to-end encryption and role-based access control

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│   │ REST API     │  │ WebSocket    │  │ CLI          │       │
│   │ Gateway      │  │ Server       │  │ Interface    │       │
│   └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      ORCHESTRATION LAYER                        │
│   ┌──────────────────────────────────────────────────┐         │
│   │           Orchestrator Agent                     │         │
│   │  - Workflow Management                           │         │
│   │  - Task Delegation                               │         │
│   │  - Result Synthesis                              │         │
│   └──────────────────────────────────────────────────┘         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      AGENT EXECUTION LAYER                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Financial │ │ Market   │ │Competitive│ │Technical │         │
│  │  Agent   │ │  Agent   │ │  Agent    │ │  Agent   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Customer  │ │  News    │ │   Risk   │ │Synthesis │         │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                   MCP INTEGRATION LAYER                         │
│   ┌──────────────────────────────────────────────────┐         │
│   │           MCP Server Manager                     │         │
│   │  - Request Routing                               │         │
│   │  - Rate Limiting                                 │         │
│   │  - Fallback Handling                             │         │
│   │  - Response Caching                              │         │
│   └──────────────────────────────────────────────────┘         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        DATA SOURCES                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │AlphaVant │ │ Exa.ai   │ │Perplexity│ │  GitHub  │         │
│  │   age    │ │          │ │          │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### Typical Request Flow

```
Client Request
      │
      ▼
┌──────────────┐
│  API Gateway │ (Authentication & Validation)
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Orchestrator    │◄────── Result Synthesis
│     Agent        │
└────┬─────────────┘
     │
     │ (Create Research Plan & Delegate)
     ▼
┌────────────────────────────────┐
│     Agent Execution Pool       │
│  ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Agent1│ │Agent2│ │Agent3│  │ (Parallel Execution)
│  └──┬───┘ └──┬───┘ └──┬───┘  │
└─────┼────────┼────────┼───────┘
      │        │        │
      ▼        ▼        ▼
┌─────────────────────────────────┐
│   MCP Integration Layer         │
│  (Query External Sources)       │
└─────────────────────────────────┘
```

## Data Flow

### Research Workflow

```
START
  │
  ▼
┌─────────────────────┐
│ Discovery Stage     │ (Basic info gathering)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Parallel Research   │────┐
│ Stage               │    │
└─────────────────────┘    │
       │                   │
       ├─► Financial ──────┤
       ├─► Market ─────────┤
       ├─► Competitive ────┤
       ├─► Technical ──────┤
       └─► Risk ───────────┤
                           │
       ┌───────────────────┘
       │
       ▼
┌─────────────────────┐
│ Validation Stage    │ (Cross-check & verify)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Gap Analysis        │ (Identify missing data)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Synthesis Stage     │ (Generate reports)
└──────┬──────────────┘
       │
       ▼
      END
```

## Agent System

### Base Agent Architecture

All agents inherit from a common base class:

```typescript
abstract class BaseAgent {
  protected id: string;
  protected config: AgentConfig;
  protected mcpManager: MCPServerManager;
  protected eventBus: EventBus;

  abstract async execute(input: AgentInput): Promise<AgentOutput>;

  protected async queryMCP(server: string, query: Query): Promise<Response>;
  protected async publishFinding(finding: Finding): Promise<void>;
  protected async log(level: string, message: string): Promise<void>;
}
```

### Agent Types

1. **Orchestrator Agent**: Master coordinator
2. **Financial Agent**: Financial analysis & valuation
3. **Market Agent**: Market sizing & industry analysis
4. **Competitive Agent**: Competitor analysis
5. **Technical Agent**: Technology evaluation
6. **Customer Agent**: Customer & revenue analysis
7. **News Agent**: News monitoring & sentiment
8. **Risk Agent**: Risk assessment
9. **Synthesis Agent**: Report generation

## MCP Integration Layer

### MCP Server Manager

Manages connections to external data sources:

```typescript
class MCPServerManager {
  async query(server: string, query: Query): Promise<Response>;
  async batchQuery(queries: BatchQuery[]): Promise<Response[]>;
  getServerStatus(server: string): ServerStatus;
}
```

### Supported MCP Servers

- **AlphaVantage**: Financial fundamentals
- **Exa.ai**: Deep web search
- **Perplexity**: Real-time search
- **GitHub**: Code repository analysis
- **NewsAPI**: News monitoring
- **Polygon.io**: Market data

### Request Flow

```
Agent Request
      │
      ▼
Check Cache ─── Hit ──► Return Cached Data
      │
      └─── Miss
           │
           ▼
      Rate Limiter
           │
           ▼
    Query MCP Server
           │
           ├─── Success ───► Cache & Return
           │
           └─── Failure ───► Try Fallback
```

## Storage and Caching

### Data Storage Strategy

```
┌─────────────────────────────────────────┐
│           PostgreSQL                    │
│  - Diligence Records                    │
│  - Findings                             │
│  - Reports                              │
│  - Audit Logs                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Redis Cache                   │
│  - MCP Responses (1 hour TTL)           │
│  - Agent State                          │
│  - Rate Limit Counters                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│       Pinecone (Vector DB)              │
│  - Research Artifacts                   │
│  - Embeddings for similarity search     │
└─────────────────────────────────────────┘
```

### Cache Hierarchy

1. **L1 Cache (In-Memory)**: 1-5 minutes TTL
2. **L2 Cache (Redis)**: 15 minutes - 1 hour TTL
3. **L3 Cache (Database)**: Permanent storage

## Security Architecture

### Authentication Flow

```
Client Request
      │
      ▼
Extract API Key
      │
      ▼
Validate Key (Redis Cache)
      │
      ├─── Valid ──► Check Permissions ──► Process Request
      │
      └─── Invalid ──► 401 Error
```

### Security Features

- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Authentication**: API key-based auth
- **Authorization**: Role-based access control
- **Audit Logging**: All actions logged
- **Rate Limiting**: Prevents abuse
- **Input Validation**: All inputs sanitized

## Scalability and Performance

### Horizontal Scaling

```
                ┌─────────────┐
                │Load Balancer│
                └──────┬──────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│   API     │  │   API     │  │   API     │
│Instance 1 │  │Instance 2 │  │Instance 3 │
└───────────┘  └───────────┘  └───────────┘
```

### Performance Optimizations

1. **Parallel Processing**: Agents work concurrently
2. **Intelligent Caching**: Multi-level cache hierarchy
3. **Connection Pooling**: Reuse database connections
4. **Request Batching**: Combine multiple API requests
5. **Response Streaming**: Stream large responses

### Performance Targets

- **P50 Latency**: <500ms for API requests
- **P95 Latency**: <2000ms for API requests
- **Throughput**: 1000+ requests/minute
- **Cache Hit Rate**: >60%

## Technology Stack

### Core Technologies

- **Language**: TypeScript/Node.js 18+
- **Framework**: Express.js / Fastify
- **Agent SDK**: Claude Agents SDK
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Vector DB**: Pinecone
- **Queue**: RabbitMQ / AWS SQS

### Infrastructure

- **Container**: Docker
- **Orchestration**: Kubernetes / AWS ECS
- **CI/CD**: GitHub Actions
- **Monitoring**: Datadog / Prometheus
- **Logging**: Winston / Pino

## Future Enhancements

1. **Real-time Monitoring**: WebSocket-based live updates
2. **Self-Improving Agents**: Feedback loop for continuous learning
3. **Custom Agent Framework**: Allow users to create custom agents
4. **Multi-Region Deployment**: Global availability
5. **Advanced Analytics**: ML-powered insights
6. **Enterprise Features**: SSO, RBAC, audit trails

## References

- [API Documentation](API.md)
- [MCP Integration Guide](MCP_INTEGRATION.md)
- [Examples](EXAMPLES.md)
