import { ContentType, Tag } from './card.js';

export interface GraphNode {
  id: string;
  title: string;
  content_type: ContentType;
  centrality: number;
  cluster_label?: string | null;
  snippet: string;
  tags: Tag[];
  created_at: string;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  weight: number;
  similarity_score: number;
  edge_type: string;
  reason: string;
  created_at: string;
}

export interface GraphStats {
  totalNodes: number;
  totalLinks: number;
  avgSimilarity: number;
  maxCentrality: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: GraphStats;
}

export interface NeighborItem {
  card: GraphNode;
  edge: GraphLink;
}

export interface CardNeighborsResponse {
  card: GraphNode;
  firstHop: NeighborItem[];
  secondHop: NeighborItem[];
}
