import axios, { AxiosError } from 'axios';
import { auth } from '../firebase/firebase';

/**
 * Resolves the appropriate backend API base URL for both development and production.
 *
 * In production (e.g. deployed to Vercel/cloud):
 * - If VITE_API_BASE_URL is configured with an https:// backend URL, uses it.
 * - If VITE_API_BASE_URL is missing or mistakenly pointing to localhost, logs a clear diagnostic
 *   message so the deployment engineer knows exactly which Vercel variable to set.
 * - Strips any trailing slashes for clean URL concatenation.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  const isBrowser = typeof window !== 'undefined';
  const isLocalhost = isBrowser && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  );

  if (isBrowser && !isLocalhost) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      console.warn(
        `[PatentAI Production Notice] Running on production host '${window.location.hostname}', ` +
        `but VITE_API_BASE_URL is set to '${envUrl || 'undefined'}'. ` +
        `To fetch live search data, set VITE_API_BASE_URL in your Vercel dashboard to your live Railway URL.`
      );
      return '/api';
    }
    return envUrl.replace(/\/+$/, '');
  }

  // Local development fallback
  return envUrl || 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl();

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

    // Automatically remove default application/json header when sending FormData
    // so the browser sets multipart/form-data with the correct boundary parameter
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: preserve structured error info from backend
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string; detail?: string | any[] }>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;

    // Extract the most descriptive message available
    let detailMsg: string | null = null;
    if (typeof data?.detail === 'string') {
      detailMsg = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      detailMsg = (data.detail as any[])
        .map((d: any) => d.msg || d.message || (typeof d === 'string' ? d : ''))
        .filter(Boolean)
        .join('; ');
    }

    const message =
      data?.message ||
      data?.error ||
      detailMsg ||
      (status === 422 ? 'Please check your input text and try again.' : error.message) ||
      'An unexpected error occurred';

    // Provide user-friendly messages for known HTTP status codes
    const friendlyMessages: Record<number, string> = {
      0: 'Cannot reach backend service. Please verify that your production API URL is active and CORS is permitted.',
      400: 'Invalid request. Please check your input.',
      401: 'Session expired or unauthenticated. Please sign in to access your saved data.',
      403: 'You do not have permission to access this resource.',
      413: 'The uploaded file is too large. Maximum size is 20 MB.',
      415: 'Only PDF files are supported. Please upload a valid PDF.',
      422: message,
      429: 'Too many requests. Please wait a moment before trying again.',
      503: 'The search service is temporarily unavailable. Please try again shortly.',
      500: 'An internal server error occurred. Please try again.',
    };

    const finalMessage = friendlyMessages[status] || message;

    console.error(`[PatentAI] API error ${status}:`, finalMessage, data);

    return Promise.reject(new ApiError(finalMessage, status, data?.error));
  }
);
