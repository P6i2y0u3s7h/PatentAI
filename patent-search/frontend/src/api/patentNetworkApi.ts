import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestorePatentNetworks,
  getFirestorePatentNetworkDetail,
  deleteFirestorePatentNetwork,
  saveFirestorePatentNetwork,
} from '../firebase/firestoreService';
import {
  PatentNetworkResponse,
  PatentNetworkHistoryResponse,
  GenericDeleteResponse,
} from '../types/patent';

export const patentNetworkApi = {
  /**
   * Generate an interactive patent similarity network from patent ID, query text, or uploaded PDF.
   */
  async generateNetwork(formData: FormData): Promise<PatentNetworkResponse> {
    const { data } = await apiClient.post<PatentNetworkResponse>('/patent-network/generate', formData);
    const userId = auth.currentUser?.uid;
    if (userId && data) {
      try {
        await saveFirestorePatentNetwork({ ...data, user_id: userId });
      } catch (_) {}
    }
    return data;
  },

  /**
   * Fast generation for a known patent ID.
   */
  async generateByPatentId(patentId: string, topK = 12): Promise<PatentNetworkResponse> {
    const { data } = await apiClient.get<PatentNetworkResponse>(`/patent-network/patent/${encodeURIComponent(patentId)}`, {
      params: { top_k: topK },
    });
    const userId = auth.currentUser?.uid;
    if (userId && data) {
      try {
        await saveFirestorePatentNetwork({ ...data, user_id: userId });
      } catch (_) {}
    }
    return data;
  },

  /**
   * Retrieve previous patent networks for current user.
   */
  async getHistory(limit = 30): Promise<PatentNetworkHistoryResponse> {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const firestoreData = await getFirestorePatentNetworks(userId, limit);
        if (firestoreData && firestoreData.entries.length > 0) {
          return firestoreData;
        }
      } catch (err) {
        console.warn('[patentNetworkApi] Direct Firestore history fallback:', err);
      }
    }

    try {
      const { data } = await apiClient.get<PatentNetworkHistoryResponse>('/patent-network/history', {
        params: { limit },
      });
      if (typeof data === 'object' && Array.isArray(data.entries)) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[patentNetworkApi] Backend API fetch notice:', apiErr);
    }

    return { entries: [], total: 0 };
  },

  /**
   * Fetch specific saved network by ID.
   */
  async getNetwork(networkId: string): Promise<PatentNetworkResponse> {
    try {
      const directDetail = await getFirestorePatentNetworkDetail(networkId);
      if (directDetail) return directDetail;
    } catch (_) {}

    const { data } = await apiClient.get<PatentNetworkResponse>(`/patent-network/${networkId}`);
    return data;
  },

  /**
   * Delete network from history.
   */
  async deleteNetwork(networkId: string): Promise<GenericDeleteResponse> {
    try {
      await deleteFirestorePatentNetwork(networkId);
    } catch (err) {
      console.warn('[patentNetworkApi] Direct Firestore delete notice:', err);
    }

    try {
      const { data } = await apiClient.delete<GenericDeleteResponse>(`/patent-network/${networkId}`);
      return data;
    } catch (_) {
      return { deleted_id: networkId, success: true };
    }
  },
};
