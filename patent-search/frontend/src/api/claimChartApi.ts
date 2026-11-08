import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestoreClaimCharts,
  getFirestoreClaimChartDetail,
  deleteFirestoreClaimChart,
  saveFirestoreClaimChart,
} from '../firebase/firestoreService';
import {
  ClaimChartResponse,
  ClaimChartHistoryResponse,
  GenericDeleteResponse,
} from '../types/patent';

export const claimChartApi = {
  /**
   * Submit Document A (Claims) and Document B (Comparison Disclosure) to generate an AI Claim Chart.
   */
  async generateClaimChart(formData: FormData): Promise<ClaimChartResponse> {
    const { data } = await apiClient.post<ClaimChartResponse>('/claim-chart/generate', formData);
    const userId = auth.currentUser?.uid;
    if (userId && data) {
      try {
        await saveFirestoreClaimChart({ ...data, user_id: userId });
      } catch (_) {}
    }
    return data;
  },

  /**
   * Retrieve previous claim charts for current user.
   */
  async getHistory(limit = 30): Promise<ClaimChartHistoryResponse> {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const firestoreData = await getFirestoreClaimCharts(userId, limit);
        if (firestoreData && firestoreData.entries.length > 0) {
          return firestoreData;
        }
      } catch (err) {
        console.warn('[claimChartApi] Direct Firestore history fallback:', err);
      }
    }

    try {
      const { data } = await apiClient.get<ClaimChartHistoryResponse>('/claim-chart/history', {
        params: { limit },
      });
      if (typeof data === 'object' && Array.isArray(data.entries)) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[claimChartApi] Backend API fetch notice:', apiErr);
    }

    return { entries: [], total: 0 };
  },

  /**
   * Fetch specific claim chart details.
   */
  async getClaimChart(chartId: string): Promise<ClaimChartResponse> {
    try {
      const directDetail = await getFirestoreClaimChartDetail(chartId);
      if (directDetail) return directDetail;
    } catch (_) {}

    const { data } = await apiClient.get<ClaimChartResponse>(`/claim-chart/${chartId}`);
    return data;
  },

  /**
   * Delete claim chart from history.
   */
  async deleteClaimChart(chartId: string): Promise<GenericDeleteResponse> {
    try {
      await deleteFirestoreClaimChart(chartId);
    } catch (err) {
      console.warn('[claimChartApi] Direct Firestore delete notice:', err);
    }

    try {
      const { data } = await apiClient.delete<GenericDeleteResponse>(`/claim-chart/${chartId}`);
      return data;
    } catch (_) {
      return { deleted_id: chartId, success: true };
    }
  },
};
