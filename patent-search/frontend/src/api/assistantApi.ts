import { apiClient } from './api';
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
   */
  async getHistory(limit: number = 30): Promise<AssistantHistoryResponse> {
    const { data } = await apiClient.get<AssistantHistoryResponse>('/assistant/history', {
      params: { limit },
    });
    return data;
  },

  /**
   * Fetch full message history for a specific session.
   */
  async getSessionDetail(chatId: string): Promise<AssistantSessionDetailResponse> {
    const { data } = await apiClient.get<AssistantSessionDetailResponse>(`/assistant/history/${chatId}`);
    return data;
  },

  /**
   * Delete a chat session.
   */
  async deleteSession(chatId: string): Promise<GenericDeleteResponse> {
    const { data } = await apiClient.delete<GenericDeleteResponse>(`/assistant/history/${chatId}`);
    return data;
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

