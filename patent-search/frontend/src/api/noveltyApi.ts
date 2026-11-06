import { apiClient } from './api';
import {
  GenericDeleteResponse,
  NoveltyAnalysisRequest,
  NoveltyAnalysisResponse,
  NoveltyHistoryResponse,
} from '../types/patent';

export const noveltyApi = {
  /**
   * Run novelty analysis via structured JSON.
   */
  async analyzeJson(request: NoveltyAnalysisRequest): Promise<NoveltyAnalysisResponse> {
    const { data } = await apiClient.post<NoveltyAnalysisResponse>('/patents/novelty-analysis', request);
    return data;
  },

  /**
   * Run novelty analysis with an uploaded invention document PDF.
   */
  async analyzePdf(
    file: File,
    title: string,
    description: string = '',
    technicalDetails: string = '',
    claims: string = ''
  ): Promise<NoveltyAnalysisResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (technicalDetails) formData.append('technical_details', technicalDetails);
    if (claims) formData.append('claims', claims);

    const { data } = await apiClient.post<NoveltyAnalysisResponse>('/patents/novelty-analysis/pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  /**
   * Fetch past novelty analyses for the current user.
   */
  async getHistory(limit: number = 20): Promise<NoveltyHistoryResponse> {
    const { data } = await apiClient.get<NoveltyHistoryResponse>('/patents/novelty/history', {
      params: { limit },
    });
    return data;
  },

  /**
   * Delete a novelty analysis record.
   */
  async deleteHistory(entryId: string): Promise<GenericDeleteResponse> {
    const { data } = await apiClient.delete<GenericDeleteResponse>(`/patents/novelty/history/${entryId}`);
    return data;
  },
};

