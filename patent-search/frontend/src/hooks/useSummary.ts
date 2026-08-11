import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/api';
import { SummaryResponse } from '../types/patent';

export const useSummarizeText = () => {
  return useMutation<SummaryResponse, Error, { text: string }>({
    mutationFn: async ({ text }) => {
      const response = await apiClient.post<SummaryResponse>('/summary/', { text });
      return response.data;
    },
  });
};

export const useSummarizePdf = () => {
  return useMutation<SummaryResponse, Error, { file: File }>({
    mutationFn: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);

      // DO NOT set Content-Type manually — axios automatically sets
      // 'multipart/form-data; boundary=...' when FormData is passed.
      const response = await apiClient.post<SummaryResponse>('/summary/pdf', formData);
      return response.data;
    },
  });
};
