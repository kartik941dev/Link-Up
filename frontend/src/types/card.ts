export type ContentType = 'note' | 'pdf' | 'docx' | 'link';

export interface Tag {
  id: string;
  name: string;
  card_count?: number;
}

export interface Card {
  id: string;
  user_id: string;
  title: string;
  content_type: ContentType;
  raw_content?: string;
  extracted_text?: string;
  snippet?: string;
  metadata?: Record<string, any>;
  centrality?: number;
  cluster_label?: string;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface CardFilterOptions {
  tag?: string;
  contentType?: ContentType | 'all';
  search?: string;
}

export interface ClusterSection {
  id: string;
  name: string;
  card_count: number;
  common_tags: string[];
  cards: Card[];
}

export interface SmartArrangeData {
  totalCards: number;
  clustersCount: number;
  clusters: ClusterSection[];
}

