import axios from 'axios';
import { auth } from '../firebase/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject Firebase Auth Token into headers
apiClient.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error fetching auth token for request', error);
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor for handling 401 unauth or server errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(customMessage));
  }
);
