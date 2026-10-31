import apiClient from './apiClient.js';
import { PLANS } from '../data/plans.js';
import { PRODUCTS } from '../data/productsPlans.js';
import { REFERENCE_DATE } from '../constants/subscriptions.js';
import { APPLIES_TO_ALL, DISCOUNT_TYPES } from '../utils/discountQueries.js';

export const discountApi = {
  async getDiscounts(params = {}) {
    const res = await apiClient.get('/discounts', { params });
    return res.data.data;
  },

  async getDiscountById(id) {
    const res = await apiClient.get(`/discounts/${id}`);
    return res.data.data;
  },

  async createDiscount(data) {
    const res = await apiClient.post('/discounts', data);
    return res.data.data;
  },

  async updateDiscount(id, data) {
    const res = await apiClient.patch(`/discounts/${id}`, data);
    return res.data.data;
  },

  async updateStatus(id, isActive) {
    const res = await apiClient.patch(`/discounts/${id}/status`, { isActive });
    return res.data.data;
  },

  async validateCoupon(code, params = {}) {
    const res = await apiClient.post('/discounts/validate', { code, ...params });
    return res.data.data;
  },
};

const ID_PREFIX = 'DSC-';
const ID_DIGITS = 3;
const CODE_PATTERN = /^[A-Z0-9_-]+$/;

export function createEmptyDiscountDraft() {
  return {
    name: '',
    code: '',
    type: '',
    value: '',
    appliesTo: APPLIES_TO_ALL,
    minPurchaseAmount: '',
    minQuantity: '',
    startDate: REFERENCE_DATE,
    endDate: '',
    usageLimit: '',
  };
}

function isBlank(value) {
  return typeof value === 'string' && value.trim() === '';
}

function normalizeCode(code) {
  return code ? code.trim().toUpperCase() : '';
}

function isFiniteAtLeast(value, minimum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum;
}

function isWholeNumberAtLeast(value, minimum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum;
}

function isKnownAppliesTo(appliesTo) {
  if (appliesTo === APPLIES_TO_ALL) return true;
  const [kind, id] = (appliesTo || '').split(':');
  if (kind === 'product') return PRODUCTS.some((product) => product.id === id);
  if (kind === 'plan') return PLANS.some((plan) => plan.id === id);
  return false;
}

export function validateDiscountDraft(draft, existingRules = []) {
  const errors = {};
  const code = normalizeCode(draft.code);
  const rawType = draft.type;

  if (isBlank(draft.name)) errors.name = 'Enter a discount rule name.';
  if (!code) {
    errors.code = 'Enter a coupon code.';
  } else if (!CODE_PATTERN.test(code)) {
    errors.code = 'Code may contain only uppercase letters, numbers, hyphens, and underscores.';
  } else if (existingRules.some((rule) => normalizeCode(rule.code) === code)) {
    errors.code = `Coupon code ${code} is already in use.`;
  }

  if (!DISCOUNT_TYPES.includes(rawType)) {
    errors.type = 'Choose a discount type.';
  } else if (rawType === 'Percentage') {
    if (isBlank(String(draft.value))) errors.value = 'Enter a percentage.';
    else if (!isFiniteAtLeast(draft.value, 0.01) || Number(draft.value) > 100) errors.value = 'Percentage must be between 0.01 and 100.';
  } else if (rawType === 'Fixed') {
    if (isBlank(String(draft.value))) errors.value = 'Enter a discount amount.';
    else if (!isFiniteAtLeast(draft.value, 0.01)) errors.value = 'Amount must be greater than zero.';
  }

  return errors;
}

export function getNextDiscountId(existingRules = []) {
  const highest = Math.max(0, ...existingRules.map((rule) => Number(rule.id?.slice?.(ID_PREFIX.length) || 0)));
  return `${ID_PREFIX}${String(highest + 1).padStart(ID_DIGITS, '0')}`;
}

export function buildDiscountRecord(draft, existingRules = []) {
  return {
    id: getNextDiscountId(existingRules),
    name: draft.name.trim(),
    code: normalizeCode(draft.code),
    type: draft.type,
    value: Number(draft.value),
    appliesTo: draft.appliesTo || APPLIES_TO_ALL,
    minPurchaseAmount: draft.minPurchaseAmount ? Number(draft.minPurchaseAmount) : null,
    minQuantity: draft.minQuantity ? Number(draft.minQuantity) : null,
    startDate: draft.startDate || REFERENCE_DATE,
    endDate: draft.endDate || null,
    usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
    usageCount: 0,
    status: 'Active',
  };
}

export function applyDiscountUsage(discounts, discountId) {
  return discounts.map((d) => (d.id === discountId ? { ...d, usageCount: (d.usageCount || 0) + 1 } : d));
}

export default discountApi;
