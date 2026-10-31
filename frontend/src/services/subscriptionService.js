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

  async updateSubscription(id, data) {
    const res = await apiClient.patch(`/subscriptions/${id}`, data);
    return res.data.data;
  },

  async pauseSubscription(id, reason = '') {
    const res = await apiClient.post(`/subscriptions/${id}/pause`, { reason });
    return res.data.data;
  },

  async resumeSubscription(id) {
    const res = await apiClient.post(`/subscriptions/${id}/resume`);
    return res.data.data;
  },

  async cancelSubscription(id, reason = '', cancelImmediately = false) {
    const res = await apiClient.post(`/subscriptions/${id}/cancel`, {
      reason,
      cancelImmediately,
    });
    return res.data.data;
  },

  async getInvoices(id, params = {}) {
    const res = await apiClient.get(`/subscriptions/${id}/invoices`, { params });
    return res.data.data;
  },

  async previewMigration(id, data) {
    const res = await apiClient.post(`/subscriptions/${id}/preview-migration`, data);
    return res.data.data;
  },

  async migratePlan(id, data) {
    const res = await apiClient.post(`/subscriptions/${id}/migrate-plan`, data);
    return res.data.data;
  },

  async cancelScheduledMigration(id) {
    const res = await apiClient.post(`/subscriptions/${id}/cancel-scheduled-migration`);
    return res.data.data;
  },

  async getMigrations(id) {
    const res = await apiClient.get(`/subscriptions/${id}/migrations`);
    return res.data.data;
  },
};

export default subscriptionService;
