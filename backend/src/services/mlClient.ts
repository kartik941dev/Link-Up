import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { pool } from '../utils/db.js';

export interface MLHealthResponse {
  status: string;
  service: string;
  model: {
    name: string;
    dimension: number;
    device: string;
    loaded: boolean;
  };
  database: {
    connected: boolean;
  };
}

export interface VectorSearchResult {
  id: string;
  user_id: string;
  title: string;
  content_type: string;
  snippet: string;
  similarity_score: number;
  tags: Array<{ id: string; name: string }>;
  created_at: string;
}

export class MLClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.mlServiceUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Check ML Service health
  async checkHealth(): Promise<MLHealthResponse | null> {
    try {
      const res = await this.client.get<MLHealthResponse>('/health');
      return res.data;
    } catch (err: any) {
      console.warn(`[MLClient] ML service health check failed at ${config.mlServiceUrl}: ${err.message}`);
      return null;
    }
  }

  // Generate dense 384d embedding for a single string
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || text.trim() === '') return null;

    try {
      const res = await this.client.post<{ embedding: number[]; dimension: number }>('/embed', {
        text: text.slice(0, 10000), // Protect against overly huge payload
      });
      return res.data.embedding;
    } catch (err: any) {
      console.warn(`[MLClient] Failed to generate embedding: ${err.message}`);
      return null;
    }
  }

  // Generate batch embeddings
  async generateBatchEmbeddings(texts: string[]): Promise<number[][] | null> {
    if (!texts || texts.length === 0) return null;

    try {
      const res = await this.client.post<{ embeddings: number[][]; dimension: number }>('/embed', {
        texts: texts.map((t) => t.slice(0, 10000)),
      });
      return res.data.embeddings;
    } catch (err: any) {
      console.warn(`[MLClient] Failed to generate batch embeddings: ${err.message}`);
      return null;
    }
  }

  // Search vector store via ML service
  async searchVector(
    userId: string,
    query: string,
    limit: number = 20,
    threshold: number = 0.0
  ): Promise<VectorSearchResult[]> {
    try {
      const res = await this.client.post<{ results: VectorSearchResult[] }>('/search/vector', {
        user_id: userId,
        query,
        limit,
        threshold,
      });
      return res.data.results || [];
    } catch (err: any) {
      console.warn(`[MLClient] Vector search endpoint failed: ${err.message}`);
      return [];
    }
  }

  // Automatically embed card and save to PostgreSQL
  async syncCardEmbedding(cardId: string, title: string, textContent: string): Promise<boolean> {
    try {
      const combinedText = `${title}\n\n${textContent}`.trim();
      if (!combinedText) return false;

      const embedding = await this.generateEmbedding(combinedText);
      if (!embedding || embedding.length !== 384) {
        return false;
      }

      const vectorString = `[${embedding.join(',')}]`;
      await pool.query(
        `UPDATE cards 
         SET embedding = $1::vector, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [vectorString, cardId]
      );

      return true;
    } catch (err: any) {
      console.warn(`[MLClient] Error syncing card embedding for card ${cardId}: ${err.message}`);
      return false;
    }
  }

  // Trigger knowledge graph construction via ML microservice
  async buildGraph(
    userId: string,
    minSimilarity: number = 0.60
  ): Promise<{
    status: string;
    node_count: number;
    edge_count: number;
    edges: any[];
    centralities: Record<string, number>;
  } | null> {
    try {
      const res = await this.client.post('/graph/build', {
        user_id: userId,
        min_similarity: minSimilarity,
      });
      return res.data;
    } catch (err: any) {
      console.warn(`[MLClient] Build graph request failed: ${err.message}`);
      return null;
    }
  }

  // Trigger smart arrange semantic clustering via ML microservice
  async smartArrange(
    userId: string,
    minSimilarity: number = 0.55
  ): Promise<{
    status: string;
    user_id: string;
    total_cards: number;
    clusters_count: number;
    clusters: Array<{
      id: string;
      name: string;
      card_count: number;
      common_tags: string[];
      cards: any[];
    }>;
  } | null> {
    try {
      const res = await this.client.post('/arrange/smart-arrange', {
        user_id: userId,
        min_similarity: minSimilarity,
      });
      return res.data;
    } catch (err: any) {
      console.warn(`[MLClient] Smart arrange request failed: ${err.message}`);
      return null;
    }
  }

  // Trigger Agentic RAG multi-hop query via ML microservice
  async queryRAG(
    userId: string,
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    cardIdsFilter?: string[]
  ): Promise<{
    query: string;
    answer: string;
    citations: Array<{
      card_id: string;
      title: string;
      content_type: string;
      snippet: string;
    }>;
    verification: {
      grounded: boolean;
      confidence: number;
      unsupported_claims: string[];
      explanation?: string;
    };
    retrieved_cards_count: number;
    graph_expansion_used: boolean;
  } | null> {
    try {
      const res = await this.client.post('/rag/query', {
        user_id: userId,
        query,
        conversation_history: conversationHistory,
        card_ids_filter: cardIdsFilter,
      });
      return res.data;
    } catch (err: any) {
      console.warn(`[MLClient] RAG query request failed: ${err.message}`);
      return null;
    }
  }
}

export const mlClient = new MLClient();
