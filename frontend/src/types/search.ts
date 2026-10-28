import { ContentType, Tag } from './card.js';

export type SearchMode = 'hybrid' | 'semantic' | 'exact';

export interface SearchResultItem {
  id: string;
  title: string;
  content_type: ContentType;
  snippet: string;
  similarity_score: number;
  match_type: 'hybrid' | 'semantic' | 'exact';
  tags: Tag[];
  created_at: string;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  total: number;
  results: SearchResultItem[];
}
