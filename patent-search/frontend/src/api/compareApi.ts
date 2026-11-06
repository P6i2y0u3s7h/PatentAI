import { apiClient } from './api';
import {
  ComparisonHistoryResponse,
  GenericDeleteResponse,
  PatentComparisonResponse,
  PatentResult,
  PatentSummaryItem,
} from '../types/patent';

export const compareApi = {
  /**
   * List all patents in the catalog for comparison picker.
   */
  async listPatents(): Promise<{ patents: PatentSummaryItem[]; total: number }> {
    const { data } = await apiClient.get<{ patents: PatentSummaryItem[]; total: number }>('/patents/list');
    return data;
  },

  /**
   * Fetch a single patent by its ID.
   */
  async getPatent(patentId: string): Promise<PatentResult> {
    const { data } = await apiClient.get<PatentResult>(`/patents/${encodeURIComponent(patentId)}`);
    return data;
  },

  /**
   * Perform side-by-side comparison between Patent A and Patent B.
   */
  async comparePatents(patentAId: string, patentBId: string): Promise<PatentComparisonResponse> {
    const { data } = await apiClient.post<PatentComparisonResponse>('/patents/compare', {
      patent_a_id: patentAId,
      patent_b_id: patentBId,
    });
    return data;
  },

  /**
   * Get user comparison history.
   */
  async getHistory(limit: number = 20): Promise<ComparisonHistoryResponse> {
    const { data } = await apiClient.get<ComparisonHistoryResponse>('/patents/compare/history', {
      params: { limit },
    });
    return data;
  },

  /**
   * Delete a comparison from history.
   */
  async deleteHistory(entryId: string): Promise<GenericDeleteResponse> {
    const { data } = await apiClient.delete<GenericDeleteResponse>(`/patents/compare/history/${entryId}`);
    return data;
  },
};

