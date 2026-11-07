import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/api';
import { SearchResponse, HistoryResponse } from '../types/patent';
import { useAuth } from './useAuth';
import {
  getFirestoreSearchHistory,
  deleteFirestoreSearchHistory,
  saveFirestoreSearchHistory,
} from '../firebase/firestoreService';

export const useSearchText = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<SearchResponse, Error, { query: string; top_k?: number }>({
    mutationFn: async ({ query, top_k = 10 }) => {
      const response = await apiClient.post<SearchResponse>('/search/', { query, top_k });
      const data = response.data;

      // Ensure local client cache and Cloud Firestore are in sync
      if (user?.uid && data?.results?.length > 0) {
        try {
          await saveFirestoreSearchHistory(user.uid, {
            user_id: user.uid,
            query_snippet: query.slice(0, 200),
            top_result_title: data.results[0]?.title,
            top_result_score: data.results[0]?.similarity_score,
            result_count: data.total_found || data.results.length,
            created_at: new Date().toISOString(),
            source: 'text',
          });
        } catch (_) {}
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchHistory'] });
    },
  });
};

export const useSearchPdf = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<SearchResponse, Error, { file: File; top_k?: number }>({
    mutationFn: async ({ file, top_k = 10 }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('top_k', top_k.toString());

      const response = await apiClient.post<SearchResponse>('/search/pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const data = response.data;

      if (user?.uid && data?.results?.length > 0) {
        try {
          await saveFirestoreSearchHistory(user.uid, {
            user_id: user.uid,
            query_snippet: `PDF Document: ${file.name}`,
            top_result_title: data.results[0]?.title,
            top_result_score: data.results[0]?.similarity_score,
            result_count: data.total_found || data.results.length,
            created_at: new Date().toISOString(),
            source: 'pdf',
          });
        } catch (_) {}
      }

      return data;
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
      if (!user?.uid) {
        return { entries: [], total: 0 };
      }

      // 1. Direct Cloud Firestore query: immediate, reliable, works directly on Vercel
      try {
        const firestoreData = await getFirestoreSearchHistory(user.uid, limit);
        if (firestoreData && Array.isArray(firestoreData.entries) && firestoreData.entries.length > 0) {
          return firestoreData;
        }
      } catch (firestoreErr) {
        console.warn('[useSearchHistory] Cloud Firestore query fallback notice:', firestoreErr);
      }

      // 2. Secondary fallback to backend API if deployed with active Railway backend
      try {
        const response = await apiClient.get<HistoryResponse>(`/search/history?limit=${limit}`);
        if (typeof response.data === 'object' && Array.isArray(response.data.entries)) {
          return response.data;
        }
      } catch (apiErr) {
        console.warn('[useSearchHistory] Backend API query notice:', apiErr);
      }

      return { entries: [], total: 0 };
    },
    enabled: !!user,
  });
};

export const useDeleteHistory = () => {
  const queryClient = useQueryClient();

  return useMutation<{ deleted_id: string; success: boolean }, Error, string>({
    mutationFn: async (entryId: string) => {
      // 1. Delete from Cloud Firestore directly
      try {
        await deleteFirestoreSearchHistory(entryId);
      } catch (err) {
        console.warn('[useDeleteHistory] Direct Firestore delete notice:', err);
      }

      // 2. Also notify backend API if reachable
      try {
        await apiClient.delete(`/search/history/${entryId}`);
      } catch (_) {}

      return { deleted_id: entryId, success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchHistory'] });
    },
  });
};
