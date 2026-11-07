import { apiClient } from './api';
import { auth } from '../firebase/firebase';
import {
  getFirestoreAssistantChats,
  getFirestoreAssistantChatDetail,
  deleteFirestoreAssistantChat,
} from '../firebase/firestoreService';
import {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantHistoryResponse,
  AssistantPdfUploadResponse,
  AssistantSessionDetailResponse,
  GenericDeleteResponse,
} from '../types/patent';

export const assistantApi = {
  /**
   * Submit a chat message to the AI Patent Assistant.
   */
  async sendMessage(request: AssistantChatRequest): Promise<AssistantChatResponse> {
    const { data } = await apiClient.post<AssistantChatResponse>('/assistant/chat', request);
    return data;
  },

  /**
   * Upload a patent document PDF to extract context and summary for RAG questioning.
   */
  async uploadPdf(file: File): Promise<AssistantPdfUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<AssistantPdfUploadResponse>('/assistant/upload-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  /**
   * Retrieve all chat sessions for the current user.
   * Checks direct Cloud Firestore first so records load instantly on deployed frontend.
   */
  async getHistory(limit: number = 30): Promise<AssistantHistoryResponse> {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const directData = await getFirestoreAssistantChats(userId, limit);
        if (directData && Array.isArray(directData.sessions) && directData.sessions.length > 0) {
          return directData;
        }
      } catch (err) {
        console.warn('[assistantApi] Firestore direct query fallback:', err);
      }
    }

    try {
      const { data } = await apiClient.get<AssistantHistoryResponse>('/assistant/history', {
        params: { limit },
      });
      if (typeof data === 'object' && Array.isArray(data.sessions)) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[assistantApi] Backend API fetch notice:', apiErr);
    }

    return { sessions: [], total: 0 };
  },

  /**
   * Fetch full message history for a specific session.
   */
  async getSessionDetail(chatId: string): Promise<AssistantSessionDetailResponse> {
    try {
      const directDetail = await getFirestoreAssistantChatDetail(chatId);
      if (directDetail) {
        return directDetail;
      }
    } catch (_) {}

    const { data } = await apiClient.get<AssistantSessionDetailResponse>(`/assistant/history/${chatId}`);
    return data;
  },

  /**
   * Delete a chat session.
   */
  async deleteSession(chatId: string): Promise<GenericDeleteResponse> {
    try {
      await deleteFirestoreAssistantChat(chatId);
    } catch (err) {
      console.warn('[assistantApi] Direct Firestore delete notice:', err);
    }

    try {
      const { data } = await apiClient.delete<GenericDeleteResponse>(`/assistant/history/${chatId}`);
      return data;
    } catch (_) {
      return { deleted_id: chatId, success: true };
    }
  },

  /**
   * Rename a chat session.
   */
  async renameSession(chatId: string, title: string): Promise<{ id: string; title: string; success: boolean }> {
    const { data } = await apiClient.patch<{ id: string; title: string; success: boolean }>(
      `/assistant/history/${chatId}`,
      { title }
    );
    return data;
  },
};
