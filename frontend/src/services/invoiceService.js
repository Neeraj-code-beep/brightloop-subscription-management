import apiClient from './apiClient.js';
import { INVOICE_NUMBER_PREFIX } from '../constants/invoices.js';
import { REFERENCE_DATE } from '../constants/subscriptions.js';
import { computeInvoiceTotals, dueDateForTerms } from '../utils/invoiceMath.js';

export const invoiceApi = {
  async getInvoices(params = {}) {
    const res = await apiClient.get('/invoices', { params });
    return res.data.data;
  },

  async getInvoiceById(id) {
    const res = await apiClient.get(`/invoices/${id}`);
    return res.data.data;
  },

  async createInvoice(data) {
    const res = await apiClient.post('/invoices', data);
    return res.data.data;
  },

  async updateInvoice(id, data) {
    const res = await apiClient.patch(`/invoices/${id}`, data);
    return res.data.data;
  },

  async issueInvoice(id) {
    const res = await apiClient.post(`/invoices/${id}/issue`);
    return res.data.data;
  },

  async voidInvoice(id, reason = '') {
    const res = await apiClient.post(`/invoices/${id}/void`, { reason });
    return res.data.data;
  },

  async getPayments(id) {
    const res = await apiClient.get(`/invoices/${id}/payments`);
    return res.data.data;
  },
};

export function nextInvoiceNumber(invoices) {
  const highest = Math.max(0, ...invoices.map((invoice) => Number(invoice.number?.slice?.(INVOICE_NUMBER_PREFIX.length) || 0)));
  return `${INVOICE_NUMBER_PREFIX}${highest + 1}`;
}

function buildTaxSnapshot(taxRule, lines, discountPercent, discountAmount) {
  if (!taxRule) return null;
  const { tax } = computeInvoiceTotals(lines, discountPercent, { ruleDiscount: discountAmount, taxRate: taxRule.rate });
  return { id: taxRule.id, name: taxRule.name, rate: taxRule.rate, amount: tax };
}

export function buildInvoiceFromSubscription(invoices, subscription, createdBy, discount, taxRule) {
  const lines = subscription.lines ? subscription.lines.map((line) => ({ ...line })) : [];
  return {
    number: nextInvoiceNumber(invoices),
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    issueDate: REFERENCE_DATE,
    dueDate: dueDateForTerms(REFERENCE_DATE, subscription.paymentTerms),
    paymentTerms: subscription.paymentTerms,
    discountPercent: subscription.discountPercent,
    discount,
    tax: buildTaxSnapshot(taxRule, lines, subscription.discountPercent, discount?.amount ?? 0),
    status: 'Draft',
    createdBy,
    lines,
  };
}

export function confirmInvoice(invoice) {
  return { ...invoice, status: 'Confirmed' };
}

export function markInvoiceSent(invoice, { recipientEmail, message }) {
  return { ...invoice, sent: { to: recipientEmail, message, on: REFERENCE_DATE } };
}

export default invoiceApi;
