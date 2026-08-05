import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/api';
import { SearchResponse, HistoryResponse } from '../types/patent';
import { useAuth } from './useAuth';

export const useSearchText = () => {
  const queryClient = useQueryClient();
  return useMutation<SearchResponse, Error, { query: string; top_k?: number }>({
    mutationFn: async ({ query, top_k = 10 }) => {
      const response = await apiClient.post<SearchResponse>('/search/', { query, top_k });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchHistory'] });
    },
  });
};

export const useSearchPdf = () => {
  const queryClient = useQueryClient();
  return useMutation<SearchResponse, Error, { file: File; top_k?: number }>({
    mutationFn: async ({ file, top_k = 10 }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('top_k', top_k.toString());

      const response = await apiClient.post<SearchResponse>('/search/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchHistory'] });
    },
  });
};

export const useSearchHistory = (limit = 50) => {
  const { user } = useAuth();
  return useQuery<HistoryResponse, Error>({
    queryKey: ['searchHistory', user?.uid, limit],
    queryFn: async () => {
      const response = await apiClient.get<HistoryResponse>(`/search/history?limit=${limit}`);
      return response.data;
    },
    enabled: !!user,
  });
};

export const useDeleteHistory = () => {
  const queryClient = useQueryClient();
  return useMutation<{ deleted_id: string; success: boolean }, Error, string>({
    mutationFn: async (entryId: string) => {
      const response = await apiClient.delete(`/search/history/${entryId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchHistory'] });
    },
  });
};
