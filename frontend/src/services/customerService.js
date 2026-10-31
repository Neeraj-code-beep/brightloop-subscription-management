import apiClient from './apiClient.js';

export const customerService = {
  async getCustomers(params = {}) {
    const res = await apiClient.get('/customers', { params });
    return res.data.data;
  },

  async getCustomerById(id) {
    const res = await apiClient.get(`/customers/${id}`);
    return res.data.data;
  },

  async createCustomer(data) {
    const res = await apiClient.post('/customers', data);
    return res.data.data;
  },

  async updateCustomer(id, data) {
    const res = await apiClient.put(`/customers/${id}`, data);
    return res.data.data;
  },

  async updateStatus(id, isActive) {
    const res = await apiClient.patch(`/customers/${id}/status`, { isActive });
    return res.data.data;
  },

  async getBillingSummary(id) {
    const res = await apiClient.get(`/customers/${id}/billing-summary`);
    return res.data.data;
  },

  async getSubscriptions(id, params = {}) {
    const res = await apiClient.get(`/customers/${id}/subscriptions`, { params });
    return res.data.data;
  },

  async getInvoices(id, params = {}) {
    const res = await apiClient.get(`/customers/${id}/invoices`, { params });
    return res.data.data;
  },

  async getPayments(id, params = {}) {
    const res = await apiClient.get(`/customers/${id}/payments`, { params });
    return res.data.data;
  },
};

export default customerService;

