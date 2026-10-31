import apiClient from './apiClient.js';

export const subscriptionService = {
  async getSubscriptions(params = {}) {
    const res = await apiClient.get('/subscriptions', { params });
    return res.data.data;
  },

  async getSubscriptionById(id) {
    const res = await apiClient.get(`/subscriptions/${id}`);
    return res.data.data;
  },

  async createSubscription(data) {
    const res = await apiClient.post('/subscriptions', data);
    return res.data.data;
  },

  async pauseSubscription(id, reason = '') {
    const res = await apiClient.patch(`/subscriptions/${id}/pause`, { reason });
    return res.data.data;
  },

  async resumeSubscription(id) {
    const res = await apiClient.patch(`/subscriptions/${id}/resume`);
    return res.data.data;
  },

  async cancelSubscription(id, reason = '', cancelImmediately = false) {
    const res = await apiClient.patch(`/subscriptions/${id}/cancel`, {
      reason,
      cancelImmediately,
    });
    return res.data.data;
  },
};

export default subscriptionService;

