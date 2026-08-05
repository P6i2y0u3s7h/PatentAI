export interface PatentResult {
  id: string;
  title: string;
  abstract: string;
  description: string;
  assignee: string;
  publication_date: string;
  country: string;
  ipc_class: string;
  similarity_score: number;
  matching_keywords: string[];
  snippet: string;
}

export interface SearchResponse {
  results: PatentResult[];
  query_length: number;
  total_found: number;
  search_time_ms: number;
}

export interface SummaryResponse {
  summary: string;
  original_length: number;
  summary_length: number;
  processing_time_ms: number;
}

export interface SearchHistoryEntry {
  id: string;
  user_id: string;
  query_snippet: string;
  top_result_title?: string;
  top_result_score?: number;
  result_count: number;
  created_at: string;
  source: 'text' | 'pdf';
}

export interface HistoryResponse {
  entries: SearchHistoryEntry[];
  total: number;
}

export interface HealthStatus {
  status: string;
  version: string;
  faiss_loaded: boolean;
  embedding_model_loaded: boolean;
  summarization_model_loaded: boolean;
  firebase_connected: boolean;
  uptime_seconds: number;
}
