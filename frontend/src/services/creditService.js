import apiClient from './apiClient.js';

export const creditService = {
  /**
   * Get customer credit balance
   */
  async getCustomerCredits(customerId) {
    const res = await apiClient.get(`/customers/${customerId}/credits`);
    return res.data.data;
  },

  /**
   * List customer credit transactions
   */
  async getCreditTransactions(customerId, params = {}) {
    const res = await apiClient.get(`/customers/${customerId}/credits/transactions`, { params });
    return res.data;
  },

  /**
   * Adjust customer credit balance (Admin)
   */
  async adjustCredits(customerId, data) {
    const res = await apiClient.post(`/customers/${customerId}/credits/adjust`, data);
    return res.data.data;
  }
};

export default creditService;
