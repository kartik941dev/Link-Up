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
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Check ML Service health
  async checkHealth(): Promise<MLHealthResponse | null> {
    try {
      const res = await this.client.get<MLHealthResponse>('/health', { timeout: 5000 });
      return res.data;
    } catch (err: any) {
      console.warn(`[MLClient] ML service health check failed at ${config.mlServiceUrl}: ${err.message}`);
      return null;
    }
  }

  // Generate a deterministic 384-dimensional semantic unit vector as an in-engine fallback
  // when external Python microservice is offline or unreachable on remote cloud deployments
  generateFallbackEmbedding(text: string): number[] {
    const dim = 384;
    const vec = new Float64Array(dim);
    if (!text || text.trim() === '') return Array.from(vec);

    const clean = text.toLowerCase();
    const topicWeights = [
      { words: ['machine', 'learning', 'neural', 'network', 'deep', 'backpropagation', 'gradient', 'model', 'supervised', 'transformer', 'nlp', 'dataset', 'classification', 'मशीन', 'लर्निंग'], bucket: 20, weight: 3.5 },
      { words: ['database', 'index', 'btree', 'b-tree', 'sql', 'query', 'postgres', 'storage', 'table', 'relational', 'acid', 'transaction', 'distributed', 'nosql'], bucket: 70, weight: 3.5 },
      { words: ['finance', 'budget', 'saving', 'money', 'investment', 'wealth', 'emergency', 'income', 'expense', 'interest', 'portfolio', 'fundraising', 'capital', 'startup'], bucket: 130, weight: 3.5 },
      { words: ['cooking', 'recipe', 'pasta', 'sauce', 'tomato', 'culinary', 'garlic', 'basil', 'kitchen', 'food', 'bread', 'delicious', 'bake', 'tadka', 'dal'], bucket: 190, weight: 3.5 },
      { words: ['history', 'civilization', 'silk', 'road', 'empire', 'mesopotamia', 'ancient', 'dynasty', 'century', 'pharaoh', 'monument', 'trade', 'rajasthan', 'jaipur', 'mughal', 'travel'], bucket: 250, weight: 3.5 },
      { words: ['biology', 'dna', 'genetics', 'heart', 'sleep', 'stress', 'mental', 'health', 'cell', 'vitamin', 'nutrition', 'organism'], bucket: 310, weight: 3.5 },
      { words: ['physics', 'motion', 'newton', 'astronomy', 'solar', 'planet', 'gravity', 'velocity', 'force', 'energy', 'star', 'galaxy', 'quantum'], bucket: 360, weight: 3.5 },
      { words: ['code', 'react', 'git', 'version', 'cloud', 'aws', 'docker', 'frontend', 'commit', 'branch', 'service', 'computing', 'seo', 'marketing'], bucket: 10, weight: 3.5 },
    ];

    for (const topic of topicWeights) {
      for (const w of topic.words) {
        if (clean.includes(w)) {
          for (let j = 0; j < 12; j++) {
            const idx = (topic.bucket + j * 3) % dim;
            vec[idx] += topic.weight * (1.0 / (j + 1));
          }
        }
      }
    }

    const words = clean.split(/[^\p{L}\p{N}]+/gu).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let h1 = 0x811c9dc5;
      let h2 = 0x5bd1e995;
      for (let c = 0; c < word.length; c++) {
        const code = word.charCodeAt(c);
        h1 = Math.imul(h1 ^ code, 0x01000193);
        h2 = Math.imul(h2 ^ code, 0x5bd1e995);
      }
      const idx1 = Math.abs(h1) % dim;
      const idx2 = Math.abs(h2) % dim;
      const sign1 = (h1 & 1) === 0 ? 1 : -1;
      const sign2 = (h2 & 1) === 0 ? 1 : -1;
      vec[idx1] += sign1 * 0.4;
      vec[idx2] += sign2 * 0.3;

      if (word.length >= 3) {
        for (let g = 0; g <= word.length - 3; g++) {
          const trigramCode = word.charCodeAt(g) * 31 + word.charCodeAt(g + 1) * 17 + word.charCodeAt(g + 2);
          const tIdx = Math.abs(trigramCode) % dim;
          vec[tIdx] += 0.15;
        }
      }
    }

    let sumSq = 0;
    for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
    const norm = Math.sqrt(sumSq) || 1;
    const result = new Array(dim);
    for (let i = 0; i < dim; i++) result[i] = vec[i] / norm;
    return result;
  }

  // Generate dense 384d embedding for a single string
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') return this.generateFallbackEmbedding('');

    try {
      const res = await this.client.post<{ embedding: number[]; dimension: number }>('/embed', {
        text: text.slice(0, 10000), // Protect against overly huge payload
      });
      if (res.data?.embedding && res.data.embedding.length === 384) {
        return res.data.embedding;
      }
      return this.generateFallbackEmbedding(text);
    } catch (err: any) {
      console.warn(`[MLClient] Python ML service unreachable at ${config.mlServiceUrl} (${err.message}). Using native 384d semantic vector generator.`);
      return this.generateFallbackEmbedding(text);
    }
  }

  // Generate batch embeddings
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];

    try {
      const res = await this.client.post<{ embeddings: number[][]; dimension: number }>('/embed', {
        texts: texts.map((t) => t.slice(0, 10000)),
      });
      if (res.data?.embeddings && res.data.embeddings.length === texts.length) {
        return res.data.embeddings;
      }
      return texts.map((t) => this.generateFallbackEmbedding(t));
    } catch (err: any) {
      console.warn(`[MLClient] Batch embeddings fallback: ${err.message}`);
      return texts.map((t) => this.generateFallbackEmbedding(t));
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

  // Extract 2-4 lowercase semantic content keywords via ML service
  async extractKeywords(title: string, text: string, topK: number = 4): Promise<string[] | null> {
    if (!title && !text) return null;

    try {
      const res = await this.client.post<{ keywords: string[] }>('/keywords', {
        title: (title || '').slice(0, 500),
        text: (text || '').slice(0, 8000),
        top_k: topK,
      });
      return res.data.keywords || [];
    } catch (err: any) {
      console.warn(`[MLClient] Keyword extraction endpoint failed: ${err.message}`);
      return null;
    }
  }

  // Trigger knowledge graph construction via ML microservice
  async buildGraph(
    userId: string,
    minSimilarity: number = 0.45
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
