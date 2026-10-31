import apiClient from './apiClient.js';

export const quotationService = {
  async getQuotations(params = {}) {
    const res = await apiClient.get('/quotations', { params });
    return res.data.data;
  },

  async getQuotationById(id) {
    const res = await apiClient.get(`/quotations/${id}`);
    return res.data.data;
  },

  async createQuotation(data) {
    const res = await apiClient.post('/quotations', data);
    return res.data.data;
  },

  async updateQuotationStatus(id, status) {
    const res = await apiClient.patch(`/quotations/${id}/status`, { status });
    return res.data.data;
  },

  async convertToSubscription(id, data = {}) {
    const res = await apiClient.post(`/quotations/${id}/convert`, data);
    return res.data.data;
  },
};

export default quotationService;

