import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor — inject JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    const apiKey = localStorage.getItem('apiKey');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (apiKey && !token) config.headers['X-API-Key'] = apiKey;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — handle 401 & token refresh ───────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          // Refresh failed — log out
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; password: string; firstName: string; lastName: string; company?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/me'),
  regenerateApiKey: () => api.post('/auth/api-key/regenerate'),
};

// ─── Projects Endpoints ───────────────────────────────────────────────────────
export const projectsAPI = {
  list: () => api.get('/projects'),
  create: (data: any) => api.post('/projects', data),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getStats: (id: string) => api.get(`/projects/${id}/stats`),
};

// ─── Test Runs Endpoints ──────────────────────────────────────────────────────
export const runsAPI = {
  trigger: (data: { projectId: string; branch?: string; testPattern?: string }) =>
    api.post('/runs', data),
  list: (params?: { projectId?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/runs', { params }),
  get: (id: string) => api.get(`/runs/${id}`),
  cancel: (id: string) => api.delete(`/runs/${id}`),
};

// ─── Subscriptions Endpoints ──────────────────────────────────────────────────
export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getMy: () => api.get('/subscriptions/me'),
  checkout: (planId: string, interval: 'monthly' | 'yearly') =>
    api.post('/subscriptions/checkout', { planId, interval }),
  openPortal: () => api.post('/subscriptions/portal'),
};

export default api;
