import apiClient from './apiClient.js';
import { TAX_STATUSES } from '../utils/taxQueries.js';

const ID_PREFIX = 'TAX-';

export const taxApi = {
  async getTaxes(params = {}) {
    const res = await apiClient.get('/taxes', { params });
    return res.data.data;
  },

  async getTaxById(id) {
    const res = await apiClient.get(`/taxes/${id}`);
    return res.data.data;
  },

  async createTax(data) {
    const res = await apiClient.post('/taxes', data);
    return res.data.data;
  },

  async updateTax(id, data) {
    const res = await apiClient.put(`/taxes/${id}`, data);
    return res.data.data;
  },

  async updateStatus(id, isActive) {
    const res = await apiClient.patch(`/taxes/${id}/status`, { isActive });
    return res.data.data;
  },
};

export function createEmptyTaxRuleDraft() {
  return { name: '', rate: '', description: '', status: 'Active' };
}

function isBlank(value) {
  return value.trim() === '';
}

export function validateTaxRuleDraft(draft, existingRules = []) {
  const errors = {};
  const name = draft.name.trim();
  const rate = Number(draft.rate);

  if (!name) {
    errors.name = 'Enter a tax rule name.';
  } else if (existingRules.some((rule) => rule.name?.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = `A tax rule named ${name} already exists.`;
  }

  if (isBlank(String(draft.rate))) {
    errors.rate = 'Enter a tax rate.';
  } else if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    errors.rate = 'Rate must be between 0 and 100.';
  }

  if (!TAX_STATUSES.includes(draft.status)) errors.status = 'Choose a status.';

  return errors;
}

export function getNextTaxId(existingRules = []) {
  const highest = Math.max(0, ...existingRules.map((rule) => Number(rule.id?.slice?.(ID_PREFIX.length) || 0)));
  return `${ID_PREFIX}${highest + 1}`;
}

export function buildTaxRuleRecord(draft, existingRules = []) {
  return {
    id: getNextTaxId(existingRules),
    name: draft.name.trim(),
    rate: Number(draft.rate),
    status: draft.status,
    description: draft.description.trim(),
  };
}

export default taxApi;
