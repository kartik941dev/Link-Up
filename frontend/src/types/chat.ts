import { Tag, ContentType } from './card.js';

export interface RAGCitation {
  card_id: string;
  title: string;
  content_type: ContentType | string;
  snippet: string;
  created_at?: string;
  tags?: Tag[];
}

export interface RAGVerification {
  grounded: boolean;
  confidence: number;
  unsupported_claims: string[];
  explanation?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RAGCitation[];
  verification?: RAGVerification;
  timestamp: string;
  retrievedCardsCount?: number;
  graphExpansionUsed?: boolean;
}

export interface RAGQueryResult {
  query: string;
  answer: string;
  citations: RAGCitation[];
  verification: RAGVerification;
  retrievedCardsCount: number;
  graphExpansionUsed: boolean;
}
