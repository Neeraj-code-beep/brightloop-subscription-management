import apiClient from './apiClient.js';

export const authService = {
  async login({ email, password }) {
    const response = await apiClient.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = response.data.data;
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    return { user, accessToken, refreshToken };
  },

  async register({ name, email, password }) {
    const response = await apiClient.post('/auth/register', { name, email, password });
    const { user, accessToken, refreshToken } = response.data.data;
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    return { user, accessToken, refreshToken };
  },

  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data.data;
  },

  async logout() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch (e) {
      // Ignore network errors on logout
      console.warn('Logout API error:', e);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  },

  async forgotPassword(email) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword({ token, newPassword }) {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};

export default authService;

