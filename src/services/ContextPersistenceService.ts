/**
 * Context Persistence Service
 * Manages vector embeddings, semantic search, and agent context with vector databases
 */

import { DatabaseClient } from '../database/client';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VectorDatabaseConfig {
  provider: 'pinecone' | 'weaviate' | 'chroma';
  apiKey?: string;
  endpoint?: string;
  indexName?: string;
  dimension?: number;
}

export interface EmbeddingVector {
  id: string;
  values: number[];
  metadata: Record<string, any>;
}

export interface SemanticSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  content?: string;
}

export interface AgentContext {
  agent_id: string;
  deal_id: string;
  session_id: string;
  context_type: 'analysis_state' | 'conversation_history' | 'partial_results' | 'dependencies';
  context_data: Record<string, any>;
  embedding?: number[];
  created_at: Date;
  expires_at?: Date;
}

export interface SearchQuery {
  query_text: string;
  deal_id: string;
  top_k?: number;
  filters?: Record<string, any>;
  min_score?: number;
}

// ============================================================================
// ABSTRACT VECTOR DATABASE CONNECTOR
// ============================================================================

abstract class VectorDatabaseConnector {
  protected config: VectorDatabaseConfig;

  constructor(config: VectorDatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract upsertVectors(namespace: string, vectors: EmbeddingVector[]): Promise<void>;
  abstract search(namespace: string, queryVector: number[], topK: number, filter?: Record<string, any>): Promise<SemanticSearchResult[]>;
  abstract deleteVectors(namespace: string, ids: string[]): Promise<void>;
  abstract deleteNamespace(namespace: string): Promise<void>;
}

// ============================================================================
// PINECONE CONNECTOR
// ============================================================================

class PineconeConnector extends VectorDatabaseConnector {
  private client: any;
  private index: any;

  async connect(): Promise<void> {
    // In production, import { PineconeClient } from '@pinecone-database/pinecone'
    logger.info('Connecting to Pinecone', {
      endpoint: this.config.endpoint,
      indexName: this.config.indexName,
    });

    // Mock implementation - replace with actual Pinecone SDK
    this.client = {
      init: async () => {},
      Index: (name: string) => ({
        upsert: async (data: any) => {},
        query: async (data: any) => ({ matches: [] }),
        delete1: async (data: any) => {},
      }),
    };

    await this.client.init({
      apiKey: this.config.apiKey,
      environment: this.config.endpoint,
    });

    this.index = this.client.Index(this.config.indexName || 'diligence-cubed');
  }

  async disconnect(): Promise<void> {
    // Pinecone doesn't require explicit disconnection
    logger.info('Disconnected from Pinecone');
  }

  async upsertVectors(namespace: string, vectors: EmbeddingVector[]): Promise<void> {
    logger.info('Upserting vectors to Pinecone', {
      namespace,
      count: vectors.length,
    });

    const upsertData = vectors.map((v) => ({
      id: v.id,
      values: v.values,
      metadata: { ...v.metadata, namespace },
    }));

    await this.index.upsert({
      vectors: upsertData,
      namespace,
    });
  }

  async search(
    namespace: string,
    queryVector: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SemanticSearchResult[]> {
    logger.info('Searching vectors in Pinecone', {
      namespace,
      topK,
      filterKeys: filter ? Object.keys(filter) : [],
    });

    const queryRequest: any = {
      vector: queryVector,
      topK,
      namespace,
      includeMetadata: true,
    };

    if (filter) {
      queryRequest.filter = filter;
    }

    const response = await this.index.query(queryRequest);

    return (response.matches || []).map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      content: match.metadata?.content,
    }));
  }

  async deleteVectors(namespace: string, ids: string[]): Promise<void> {
    logger.info('Deleting vectors from Pinecone', {
      namespace,
      count: ids.length,
    });

    await this.index.delete1({
      ids,
      namespace,
    });
  }

  async deleteNamespace(namespace: string): Promise<void> {
    logger.info('Deleting namespace from Pinecone', { namespace });

    await this.index.delete1({
      deleteAll: true,
      namespace,
    });
  }
}

// ============================================================================
// WEAVIATE CONNECTOR
// ============================================================================

class WeaviateConnector extends VectorDatabaseConnector {
  private client: any;
  private className: string = 'DiligenceCubedDocument';

  async connect(): Promise<void> {
    // In production, import weaviate from 'weaviate-ts-client'
    logger.info('Connecting to Weaviate', {
      endpoint: this.config.endpoint,
    });

    // Mock implementation - replace with actual Weaviate SDK
    this.client = {
      data: {
        creator: () => ({
          withClassName: () => ({
            withProperties: () => ({
              withVector: () => ({
                do: async () => {},
              }),
            }),
          }),
        }),
        deleter: () => ({
          withClassName: () => ({
            withWhere: () => ({
              do: async () => {},
            }),
          }),
        }),
      },
      graphql: {
        get: () => ({
          withClassName: () => ({
            withNearVector: () => ({
              withLimit: () => ({
                withWhere: () => ({
                  withFields: () => ({
                    do: async () => ({ data: { Get: {} } }),
                  }),
                }),
              }),
            }),
          }),
        }),
      },
    };
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnected from Weaviate');
  }

  async upsertVectors(namespace: string, vectors: EmbeddingVector[]): Promise<void> {
    logger.info('Upserting vectors to Weaviate', {
      namespace,
      count: vectors.length,
    });

    for (const vector of vectors) {
      await this.client.data
        .creator()
        .withClassName(this.className)
        .withProperties({
          ...vector.metadata,
          vector_id: vector.id,
          namespace,
        })
        .withVector(vector.values)
        .do();
    }
  }

  async search(
    namespace: string,
    queryVector: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SemanticSearchResult[]> {
    logger.info('Searching vectors in Weaviate', {
      namespace,
      topK,
      filterKeys: filter ? Object.keys(filter) : [],
    });

    let query = this.client.graphql
      .get()
      .withClassName(this.className)
      .withNearVector({ vector: queryVector })
      .withLimit(topK)
      .withFields('vector_id content _additional { certainty }');

    // Add namespace filter
    const whereFilter: any = {
      path: ['namespace'],
      operator: 'Equal',
      valueString: namespace,
    };

    // Add additional filters
    if (filter && Object.keys(filter).length > 0) {
      const filters = Object.entries(filter).map(([key, value]) => ({
        path: [key],
        operator: 'Equal',
        valueString: String(value),
      }));

      query = query.withWhere({
        operator: 'And',
        operands: [whereFilter, ...filters],
      });
    } else {
      query = query.withWhere(whereFilter);
    }

    const response = await query.do();
    const results = response.data?.Get?.[this.className] || [];

    return results.map((result: any) => ({
      id: result.vector_id,
      score: result._additional?.certainty || 0,
      metadata: result,
      content: result.content,
    }));
  }

  async deleteVectors(namespace: string, ids: string[]): Promise<void> {
    logger.info('Deleting vectors from Weaviate', {
      namespace,
      count: ids.length,
    });

    for (const id of ids) {
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withWhere({
          operator: 'And',
          operands: [
            { path: ['namespace'], operator: 'Equal', valueString: namespace },
            { path: ['vector_id'], operator: 'Equal', valueString: id },
          ],
        })
        .do();
    }
  }

  async deleteNamespace(namespace: string): Promise<void> {
    logger.info('Deleting namespace from Weaviate', { namespace });

    await this.client.data
      .deleter()
      .withClassName(this.className)
      .withWhere({
        path: ['namespace'],
        operator: 'Equal',
        valueString: namespace,
      })
      .do();
  }
}

// ============================================================================
// CONTEXT PERSISTENCE SERVICE
// ============================================================================

export class ContextPersistenceService {
  private vectorDb: VectorDatabaseConnector;
  private embeddingDimension: number = 1536; // OpenAI ada-002 dimension

  constructor(
    private db: DatabaseClient,
    private vectorDbConfig: VectorDatabaseConfig
  ) {
    // Initialize appropriate vector database connector
    if (vectorDbConfig.provider === 'pinecone') {
      this.vectorDb = new PineconeConnector(vectorDbConfig);
    } else if (vectorDbConfig.provider === 'weaviate') {
      this.vectorDb = new WeaviateConnector(vectorDbConfig);
    } else {
      throw new Error(`Unsupported vector database provider: ${vectorDbConfig.provider}`);
    }

    this.embeddingDimension = vectorDbConfig.dimension || 1536;
  }

  /**
   * Initialize connection to vector database
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Context Persistence Service', {
      provider: this.vectorDbConfig.provider,
    });

    await this.vectorDb.connect();

    // Create agent_contexts table if not exists
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS agent_contexts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR(100) NOT NULL,
        deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        context_type VARCHAR(50) NOT NULL,
        context_data JSONB NOT NULL,
        embedding_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        INDEX idx_agent_contexts_deal (deal_id),
        INDEX idx_agent_contexts_session (session_id),
        INDEX idx_agent_contexts_agent (agent_id)
      );
    `);
  }

  /**
   * Disconnect from vector database
   */
  async shutdown(): Promise<void> {
    await this.vectorDb.disconnect();
  }

  // ==========================================================================
  // DOCUMENT & FINDING EMBEDDING
  // ==========================================================================

  /**
   * Index document for semantic search
   */
  async indexDocument(
    documentId: string,
    dealId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    logger.info('Indexing document', { documentId, dealId });

    // Generate embedding for document content
    const embedding = await this.generateEmbedding(content);

    // Store in vector database with deal-specific namespace
    const namespace = this.getDealNamespace(dealId);
    const vector: EmbeddingVector = {
      id: `doc_${documentId}`,
      values: embedding,
      metadata: {
        type: 'document',
        document_id: documentId,
        deal_id: dealId,
        content: content.substring(0, 1000), // Store excerpt
        ...metadata,
      },
    };

    await this.vectorDb.upsertVectors(namespace, [vector]);

    logger.info('Document indexed successfully', { documentId });
  }

  /**
   * Index finding for semantic search
   */
  async indexFinding(
    findingId: string,
    dealId: string,
    title: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    logger.info('Indexing finding', { findingId, dealId });

    // Combine title and description for embedding
    const content = `${title}\n\n${description}`;
    const embedding = await this.generateEmbedding(content);

    const namespace = this.getDealNamespace(dealId);
    const vector: EmbeddingVector = {
      id: `finding_${findingId}`,
      values: embedding,
      metadata: {
        type: 'finding',
        finding_id: findingId,
        deal_id: dealId,
        title,
        content: description.substring(0, 1000),
        ...metadata,
      },
    };

    await this.vectorDb.upsertVectors(namespace, [vector]);

    logger.info('Finding indexed successfully', { findingId });
  }

  /**
   * Perform semantic search across documents and findings
   */
  async semanticSearch(query: SearchQuery): Promise<SemanticSearchResult[]> {
    logger.info('Performing semantic search', {
      dealId: query.deal_id,
      queryLength: query.query_text.length,
    });

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query.query_text);

    // Search in deal-specific namespace
    const namespace = this.getDealNamespace(query.deal_id);
    const results = await this.vectorDb.search(
      namespace,
      queryEmbedding,
      query.top_k || 10,
      query.filters
    );

    // Filter by minimum score if specified
    const filteredResults = query.min_score
      ? results.filter((r) => r.score >= query.min_score!)
      : results;

    logger.info('Semantic search completed', {
      dealId: query.deal_id,
      resultsCount: filteredResults.length,
    });

    return filteredResults;
  }

  /**
   * Find similar findings to a given finding
   */
  async findSimilarFindings(
    findingId: string,
    dealId: string,
    topK: number = 5
  ): Promise<SemanticSearchResult[]> {
    logger.info('Finding similar findings', { findingId, dealId });

    // Get the finding's embedding from vector DB
    const namespace = this.getDealNamespace(dealId);

    // First, search for the finding itself to get its vector
    const finding = await this.db.query<{ title: string; description: string }>(
      'SELECT title, description FROM findings WHERE id = $1',
      [findingId]
    );

    if (finding.rows.length === 0) {
      return [];
    }

    const content = `${finding.rows[0].title}\n\n${finding.rows[0].description}`;
    const embedding = await this.generateEmbedding(content);

    // Search for similar vectors
    const results = await this.vectorDb.search(
      namespace,
      embedding,
      topK + 1, // +1 to exclude the finding itself
      { type: 'finding' }
    );

    // Filter out the original finding
    return results.filter((r) => r.id !== `finding_${findingId}`);
  }

  /**
   * Delete document or finding from vector index
   */
  async deleteFromIndex(id: string, dealId: string, type: 'document' | 'finding'): Promise<void> {
    logger.info('Deleting from vector index', { id, dealId, type });

    const namespace = this.getDealNamespace(dealId);
    const vectorId = `${type}_${id}`;

    await this.vectorDb.deleteVectors(namespace, [vectorId]);
  }

  /**
   * Delete entire deal namespace (used when deal is deleted)
   */
  async deleteDealIndex(dealId: string): Promise<void> {
    logger.info('Deleting deal vector index', { dealId });

    const namespace = this.getDealNamespace(dealId);
    await this.vectorDb.deleteNamespace(namespace);
  }

  // ==========================================================================
  // AGENT CONTEXT MANAGEMENT
  // ==========================================================================

  /**
   * Store agent context for later retrieval
   */
  async saveAgentContext(context: Omit<AgentContext, 'created_at'>): Promise<string> {
    logger.info('Saving agent context', {
      agentId: context.agent_id,
      dealId: context.deal_id,
      sessionId: context.session_id,
      contextType: context.context_type,
    });

    // Optionally generate embedding for context data for semantic retrieval
    let embeddingId: string | null = null;
    if (context.embedding) {
      embeddingId = `context_${context.session_id}_${Date.now()}`;
      const namespace = this.getDealNamespace(context.deal_id);

      await this.vectorDb.upsertVectors(namespace, [
        {
          id: embeddingId,
          values: context.embedding,
          metadata: {
            type: 'agent_context',
            agent_id: context.agent_id,
            deal_id: context.deal_id,
            session_id: context.session_id,
            context_type: context.context_type,
          },
        },
      ]);
    }

    // Store in PostgreSQL
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO agent_contexts
       (agent_id, deal_id, session_id, context_type, context_data, embedding_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        context.agent_id,
        context.deal_id,
        context.session_id,
        context.context_type,
        JSON.stringify(context.context_data),
        embeddingId,
        context.expires_at || null,
      ]
    );

    logger.info('Agent context saved', { contextId: result.rows[0].id });
    return result.rows[0].id;
  }

  /**
   * Retrieve agent context by session
   */
  async getAgentContext(
    sessionId: string,
    contextType?: string
  ): Promise<AgentContext[]> {
    logger.info('Retrieving agent context', { sessionId, contextType });

    let query = 'SELECT * FROM agent_contexts WHERE session_id = $1';
    const params: any[] = [sessionId];

    if (contextType) {
      query += ' AND context_type = $2';
      params.push(contextType);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query<AgentContext>(query, params);

    return result.rows.map((row) => ({
      ...row,
      context_data: typeof row.context_data === 'string'
        ? JSON.parse(row.context_data)
        : row.context_data,
    }));
  }

  /**
   * Retrieve latest agent context for a deal
   */
  async getLatestAgentContext(
    dealId: string,
    agentId: string,
    contextType: string
  ): Promise<AgentContext | null> {
    logger.info('Retrieving latest agent context', { dealId, agentId, contextType });

    const result = await this.db.query<AgentContext>(
      `SELECT * FROM agent_contexts
       WHERE deal_id = $1 AND agent_id = $2 AND context_type = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId, agentId, contextType]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      context_data: typeof row.context_data === 'string'
        ? JSON.parse(row.context_data)
        : row.context_data,
    };
  }

  /**
   * Clean up expired agent contexts
   */
  async cleanupExpiredContexts(): Promise<number> {
    logger.info('Cleaning up expired agent contexts');

    const result = await this.db.query<{ count: string }>(
      `DELETE FROM agent_contexts
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING *`
    );

    const deletedCount = result.rowCount || 0;
    logger.info('Expired contexts cleaned up', { count: deletedCount });

    return deletedCount;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate deal-specific namespace for vector isolation
   */
  private getDealNamespace(dealId: string): string {
    return `deal_${dealId}`;
  }

  /**
   * Generate embedding vector for text
   * In production, use OpenAI embeddings API or similar
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Mock implementation - in production, call OpenAI API:
    // const response = await openai.createEmbedding({
    //   model: "text-embedding-ada-002",
    //   input: text,
    // });
    // return response.data.data[0].embedding;

    // For now, return a random vector of correct dimension
    return Array.from({ length: this.embeddingDimension }, () => Math.random() * 2 - 1);
  }

  /**
   * Batch index multiple documents
   */
  async batchIndexDocuments(
    documents: Array<{
      documentId: string;
      dealId: string;
      content: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    logger.info('Batch indexing documents', { count: documents.length });

    // Group by deal for namespace efficiency
    const byDeal = documents.reduce((acc, doc) => {
      if (!acc[doc.dealId]) acc[doc.dealId] = [];
      acc[doc.dealId].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    for (const [dealId, dealDocs] of Object.entries(byDeal)) {
      const namespace = this.getDealNamespace(dealId);
      const vectors: EmbeddingVector[] = [];

      for (const doc of dealDocs) {
        const embedding = await this.generateEmbedding(doc.content);
        vectors.push({
          id: `doc_${doc.documentId}`,
          values: embedding,
          metadata: {
            type: 'document',
            document_id: doc.documentId,
            deal_id: dealId,
            content: doc.content.substring(0, 1000),
            ...doc.metadata,
          },
        });
      }

      await this.vectorDb.upsertVectors(namespace, vectors);
    }

    logger.info('Batch indexing completed', { count: documents.length });
  }
}
