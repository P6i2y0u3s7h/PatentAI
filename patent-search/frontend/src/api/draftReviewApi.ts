import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestoreDraftReviews,
  getFirestoreDraftReviewDetail,
  deleteFirestoreDraftReview,
  saveFirestoreDraftReview,
} from '../firebase/firestoreService';
import {
  DraftReviewResponse,
  DraftReviewHistoryResponse,
  GenericDeleteResponse,
} from '../types/patent';

export const draftReviewApi = {
  /**
   * Submit patent draft for AI structural and technical review.
   */
  async analyzeDraft(formData: FormData): Promise<DraftReviewResponse> {
    const { data } = await apiClient.post<DraftReviewResponse>('/draft-review/analyze', formData);
    // Sync to direct Firestore client if user logged in
    const userId = auth.currentUser?.uid;
    if (userId && data) {
      try {
        await saveFirestoreDraftReview({ ...data, user_id: userId });
      } catch (_) {}
    }
    return data;
  },

  /**
   * Retrieve previous draft reviews for the current user.
   * Direct Cloud Firestore first for high availability after production deployment.
   */
  async getHistory(limit = 30): Promise<DraftReviewHistoryResponse> {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const firestoreData = await getFirestoreDraftReviews(userId, limit);
        if (firestoreData && firestoreData.entries.length > 0) {
          return firestoreData;
        }
      } catch (err) {
        console.warn('[draftReviewApi] Direct Firestore history fallback:', err);
      }
    }

    try {
      const { data } = await apiClient.get<DraftReviewHistoryResponse>('/draft-review/history', {
        params: { limit },
      });
      if (typeof data === 'object' && Array.isArray(data.entries)) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[draftReviewApi] Backend API fetch notice:', apiErr);
    }

    return { entries: [], total: 0 };
  },

  /**
   * Retrieve specific review report by ID.
   */
  async getReview(reviewId: string): Promise<DraftReviewResponse> {
    try {
      const directDetail = await getFirestoreDraftReviewDetail(reviewId);
      if (directDetail) return directDetail;
    } catch (_) {}

    const { data } = await apiClient.get<DraftReviewResponse>(`/draft-review/${reviewId}`);
    return data;
  },

  /**
   * Delete a draft review from history.
   */
  async deleteReview(reviewId: string): Promise<GenericDeleteResponse> {
    try {
      await deleteFirestoreDraftReview(reviewId);
    } catch (err) {
      console.warn('[draftReviewApi] Direct Firestore delete notice:', err);
    }

    try {
      const { data } = await apiClient.delete<GenericDeleteResponse>(`/draft-review/${reviewId}`);
      return data;
    } catch (_) {
      return { deleted_id: reviewId, success: true };
    }
  },
};
