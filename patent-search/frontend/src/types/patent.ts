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

// ── AI Assistant Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  sources?: string[];
}

export interface AssistantChatRequest {
  message: string;
  chat_id?: string;
  doc_context?: string;
  doc_name?: string;
  history?: ChatMessage[];
}

export interface AssistantChatResponse {
  response: string;
  chat_id: string;
  title: string;
  sources: string[];
  processing_time_ms: number;
}

export interface AssistantSession {
  id: string;
  user_id: string;
  title: string;
  doc_name?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface AssistantHistoryResponse {
  sessions: AssistantSession[];
  total: number;
}

export interface AssistantSessionDetailResponse {
  session: AssistantSession;
  messages: ChatMessage[];
}

export interface AssistantPdfUploadResponse {
  filename: string;
  doc_context: string;
  char_count: number;
  word_count: number;
  page_count: number;
  summary: string;
}

// ── Patent Comparison Types ──────────────────────────────────────────────────

export interface PatentSummaryItem {
  id: string;
  title: string;
  assignee: string;
  publication_date: string;
  ipc_class: string;
  country: string;
  abstract_snippet: string;
}

export interface PatentFeatureComparison {
  parameter: string;
  patent_a: string;
  patent_b: string;
}

export interface PatentComparisonResponse {
  patent_a: PatentResult;
  patent_b: PatentResult;
  similarity_percentage: number;
  parameters_table: PatentFeatureComparison[];
  similarities: string[];
  differences: string[];
  common_features: string[];
  unique_features_a: string[];
  unique_features_b: string[];
  methodology_comparison: string;
  claims_comparison: string;
  technical_advantages_a: string[];
  technical_advantages_b: string[];
  summary: string;
  processing_time_ms: number;
}

export interface ComparisonHistoryEntry {
  id: string;
  user_id: string;
  patent_a_id: string;
  patent_a_title: string;
  patent_b_id: string;
  patent_b_title: string;
  similarity_percentage: number;
  created_at: string;
}

export interface ComparisonHistoryResponse {
  entries: ComparisonHistoryEntry[];
  total: number;
}

// ── AI Novelty Analysis Types ────────────────────────────────────────────────

export interface NoveltyAnalysisRequest {
  title: string;
  description: string;
  technical_details?: string;
  claims?: string;
}

export interface NoveltyOverview {
  novelty_score: number;
  novelty_verdict: string;
  confidence_score: number;
  relevant_patents_count: number;
  most_relevant_patent_id: string;
  most_relevant_patent_title: string;
  highest_similarity_score: number;
}

export interface TechnicalFeatureAnalysis {
  disclosed_features: string[];
  distinguishing_features: string[];
  similar_technical_approaches: string[];
  potential_overlaps: string[];
}

export interface NoveltyPatentReference {
  id: string;
  title: string;
  abstract: string;
  similarity_percentage: number;
  relevant_features: string[];
  assignee: string;
  publication_date: string;
  ipc_class: string;
}

export interface AIRecommendations {
  areas_for_investigation: string[];
  distinguishing_features_guidance: string[];
  suggested_prior_art_searches: string[];
}

export interface NoveltyAnalysisResponse {
  id: string;
  title: string;
  overview: NoveltyOverview;
  technical_features: TechnicalFeatureAnalysis;
  prior_art_references: NoveltyPatentReference[];
  recommendations: AIRecommendations;
  final_summary: string;
  disclaimer: string;
  created_at: string;
  processing_time_ms: number;
}

export interface NoveltyHistoryEntry {
  id: string;
  user_id: string;
  title: string;
  novelty_verdict: string;
  highest_similarity_score: number;
  relevant_patents_count: number;
  created_at: string;
}

export interface NoveltyHistoryResponse {
  entries: NoveltyHistoryEntry[];
  total: number;
}

export interface GenericDeleteResponse {
  deleted_id: string;
  success: boolean;
}

