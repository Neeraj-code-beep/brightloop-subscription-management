import apiClient from './apiClient.js';
import { PAYMENT_ID_PREFIX } from '../constants/invoices.js';

export const paymentApi = {
  async getPayments(params = {}) {
    const res = await apiClient.get('/payments', { params });
    return res.data.data;
  },

  async getPaymentById(id) {
    const res = await apiClient.get(`/payments/${id}`);
    return res.data.data;
  },

  async recordPayment(data) {
    const res = await apiClient.post('/payments', data);
    return res.data.data;
  },

  async processRefund(paymentId, data) {
    const res = await apiClient.post(`/payments/${paymentId}/refund`, data);
    return res.data.data;
  },

  async getReconciliationSummary(params = {}) {
    const res = await apiClient.get('/payments/reconciliation/summary', { params });
    return res.data.data;
  },
};

export function nextPaymentId(payments) {
  const highest = Math.max(0, ...payments.map((payment) => Number(payment.id?.slice?.(PAYMENT_ID_PREFIX.length) || 0)));
  return `${PAYMENT_ID_PREFIX}${String(highest + 1).padStart(4, '0')}`;
}

export function buildPayment(payments, invoice, { date, method, amount, reference }) {
  return {
    id: nextPaymentId(payments),
    invoiceNumber: invoice.number,
    customerId: invoice.customerId,
    date,
    method,
    amount,
    reference,
  };
}

export default paymentApi;
