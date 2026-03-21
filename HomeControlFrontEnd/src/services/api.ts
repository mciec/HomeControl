import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const authService = {
  getStatus: async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
  },

  getUser: async () => {
    const response = await apiClient.get('/auth/user');
    return response.data;
  },

  login: () => {
    window.location.href = '/api/auth/login';
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },
};

export const sampleService = {
  getPublicData: async () => {
    const response = await apiClient.get('/sample/public');
    return response.data;
  },

  getProtectedData: async () => {
    const response = await apiClient.get('/sample/protected');
    return response.data;
  },
};

export default apiClient;
