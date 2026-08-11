import axios, { AxiosError } from 'axios';
import { auth } from '../firebase/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Typed API error that preserves HTTP status and backend error codes.
 * This allows the UI to differentiate between auth failures, validation
 * errors, server errors, etc. instead of showing a generic message.
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject Firebase Auth Token into headers
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[PatentAI] Error fetching auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: preserve structured error info from backend
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string; detail?: string }>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;

    // Extract the most descriptive message available
    const message =
      data?.message ||
      data?.error ||
      (typeof data?.detail === 'string' ? data.detail : null) ||
      error.message ||
      'An unexpected error occurred';

    // Provide user-friendly messages for known HTTP status codes
    const friendlyMessages: Record<number, string> = {
      400: 'Invalid request. Please check your input.',
      401: 'Your session has expired. Please log in again.',
      403: 'You do not have permission to perform this action.',
      413: 'The uploaded file is too large. Maximum size is 20 MB.',
      415: 'Only PDF files are supported. Please upload a valid PDF.',
      422: message, // Use backend message (extraction failed, short query, etc.)
      429: 'Too many requests. Please wait a moment before trying again.',
      503: 'The search service is temporarily unavailable. Please try again shortly.',
      500: 'An internal server error occurred. Please try again.',
    };

    const finalMessage = friendlyMessages[status] || message;

    console.error(`[PatentAI] API error ${status}:`, finalMessage, data);

    return Promise.reject(new ApiError(finalMessage, status, data?.error));
  }
);
