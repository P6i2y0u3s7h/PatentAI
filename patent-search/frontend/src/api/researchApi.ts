import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestoreResearchHistory,
  getFirestoreResearchDetail,
  deleteFirestoreResearch,
} from '../firebase/firestoreService';

export interface ResearchStep {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: string;
}

export interface ResearchStatusResponse {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_step: number;
  progress_percent: number;
  current_step_name: string;
  steps: ResearchStep[];
  logs: string[];
  error?: string | null;
  has_results: boolean;
}

export interface CitedPatent {
  id: string;
  title: string;
  abstract: string;
  assignee: string;
  publication_date: string;
  ipc_class: string;
  similarity_score: number;
  matched_queries: string[];
  matching_keywords: string[];
  snippet?: string;
  source_url: string;
}

export interface PatentFeatureAnalysis {
  patent_id: string;
  patent_title: string;
  similarity_score: number;
  similar_features: string[];
  different_features: string[];
  overlapping_scope: string;
  threat_level: 'High' | 'Moderate' | 'Low';
}

export interface ResearchResults {
  task_id: string;
  invention_title: string;
  technical_field: string;
  research_objective: string;
  execution_time_seconds: number;
  created_at: string;
  understanding: {
    keywords: string[];
    technical_components: string[];
    problem_solved: string;
    proposed_solution: string;
    core_innovation: string;
  };
  queries: Array<{ concept: string; query: string }>;
  patents: CitedPatent[];
  analyses: PatentFeatureAnalysis[];
  gaps: string[];
  distinctive_features: string[];
  recommendations: string[];
  report_markdown: string;
  metrics: {
    patents_retrieved: number;
    highly_relevant_count: number;
    top_similarity: number;
    avg_similarity: number;
    query_count: number;
  };
}

export interface FollowUpResponse {
  answer: string;
  citations: Array<{ id: string; title: string; url: string; score: number }>;
  timestamp: string;
}

export interface ResearchHistoryItem {
  id: string;
  user_id: string;
  invention_title: string;
  technical_field: string;
  query_count: number;
  patents_found: number;
  top_similarity: number;
  created_at: string;
  summary: string;
  full_data?: ResearchResults;
}

export const researchApi = {
  startResearch: async (formData: FormData): Promise<{ task_id: string; status: string; message: string }> => {
    const res = await apiClient.post('/api/research/start', formData);
    return res.data;
  },

  getStatus: async (taskId: string): Promise<ResearchStatusResponse> => {
    const res = await apiClient.get(`/api/research/status/${taskId}`);
    return res.data;
  },

  getResults: async (taskId: string): Promise<ResearchResults> => {
    try {
      const directDetail = await getFirestoreResearchDetail(taskId);
      if (directDetail) {
        return directDetail;
      }
    } catch (_) {}

    const res = await apiClient.get(`/api/research/results/${taskId}`);
    return res.data;
  },

  askFollowUp: async (taskId: string, question: string): Promise<FollowUpResponse> => {
    const res = await apiClient.post('/api/research/follow-up', {
      task_id: taskId,
      question,
    });
    return res.data;
  },

  getHistory: async (): Promise<ResearchHistoryItem[]> => {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const firestoreItems = await getFirestoreResearchHistory(userId, 30);
        if (firestoreItems && firestoreItems.length > 0) {
          return firestoreItems;
        }
      } catch (err) {
        console.warn('[researchApi] Direct Firestore research history notice:', err);
      }
    }

    try {
      const res = await apiClient.get('/api/research/history');
      if (Array.isArray(res.data)) {
        return res.data;
      }
    } catch (apiErr) {
      console.warn('[researchApi] Backend API research history notice:', apiErr);
    }

    return [];
  },

  deleteHistory: async (taskId: string): Promise<{ success: boolean; task_id: string }> => {
    try {
      await deleteFirestoreResearch(taskId);
    } catch (err) {
      console.warn('[researchApi] Direct Firestore delete notice:', err);
    }

    try {
      const res = await apiClient.delete(`/api/research/${taskId}`);
      return res.data;
    } catch (_) {
      return { success: true, task_id: taskId };
    }
  },
};
