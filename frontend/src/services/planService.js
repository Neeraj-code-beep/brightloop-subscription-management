import apiClient from './apiClient.js';

export const planService = {
  async getPlans(params = {}) {
    const res = await apiClient.get('/plans', { params });
    return res.data.data;
  },

  async getPlanById(id) {
    const res = await apiClient.get(`/plans/${id}`);
    return res.data.data;
  },

  async createPlan(data) {
    const res = await apiClient.post('/plans', data);
    return res.data.data;
  },

  async updatePlan(id, data) {
    const res = await apiClient.patch(`/plans/${id}`, data);
    return res.data.data;
  },

  async updateStatus(id, isActive) {
    const res = await apiClient.patch(`/plans/${id}/status`, { isActive });
    return res.data.data;
  },
};

export default planService;
