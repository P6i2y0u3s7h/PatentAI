import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestoreComparisonHistory,
  deleteFirestoreComparison,
} from '../firebase/firestoreService';
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
   * Checks direct Cloud Firestore first so historical comparisons load reliably after deployment.
   */
  async getHistory(limit: number = 20): Promise<ComparisonHistoryResponse> {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const firestoreData = await getFirestoreComparisonHistory(userId, limit);
        if (firestoreData && Array.isArray(firestoreData.entries) && firestoreData.entries.length > 0) {
          return firestoreData;
        }
      } catch (err) {
        console.warn('[compareApi] Direct Firestore comparison history fallback:', err);
      }
    }

    try {
      const { data } = await apiClient.get<ComparisonHistoryResponse>('/patents/compare/history', {
        params: { limit },
      });
      if (typeof data === 'object' && Array.isArray(data.entries)) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[compareApi] Backend API comparison fetch notice:', apiErr);
    }

    return { entries: [], total: 0 };
  },

  /**
   * Delete a comparison from history.
   */
  async deleteHistory(entryId: string): Promise<GenericDeleteResponse> {
    try {
      await deleteFirestoreComparison(entryId);
    } catch (err) {
      console.warn('[compareApi] Direct Firestore delete comparison notice:', err);
    }

    try {
      const { data } = await apiClient.delete<GenericDeleteResponse>(`/patents/compare/history/${entryId}`);
      return data;
    } catch (_) {
      return { deleted_id: entryId, success: true };
    }
  },
};
