import apiClient from './apiClient.js';

export const analyticsService = {
  async getDashboard() {
    const res = await apiClient.get('/analytics/dashboard');
    return res.data.data;
  },

  async getSummary() {
    const res = await apiClient.get('/analytics/summary');
    return res.data.data;
  },

  async getRevenue(interval = 'month') {
    const res = await apiClient.get('/analytics/revenue', { params: { interval } });
    return res.data.data;
  },

  async getMrr() {
    const res = await apiClient.get('/analytics/mrr');
    return res.data.data;
  },

  async getArr() {
    const res = await apiClient.get('/analytics/arr');
    return res.data.data;
  },

  async getCustomers() {
    const res = await apiClient.get('/analytics/customers');
    return res.data.data;
  },

  async getSubscriptions() {
    const res = await apiClient.get('/analytics/subscriptions');
    return res.data.data;
  },

  async getInvoices() {
    const res = await apiClient.get('/analytics/invoices');
    return res.data.data;
  },

  async getOverdue() {
    const res = await apiClient.get('/analytics/overdue');
    return res.data.data;
  },

  async getPayments() {
    const res = await apiClient.get('/analytics/payments');
    return res.data.data;
  },
};

export default analyticsService;

