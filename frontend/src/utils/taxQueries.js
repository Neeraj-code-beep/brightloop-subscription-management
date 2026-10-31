import { TAX_RATE_PERCENT } from '../constants/subscriptions.js'

export const TAX_STATUSES = ['Active', 'Inactive']

export function getApplicableTax(taxRules) {
  return taxRules.find((rule) => rule.status === 'Active' && rule.rate === TAX_RATE_PERCENT) ?? null
}

export function summarizeTaxRules(taxRules) {
  const active = taxRules.filter((rule) => rule.status === 'Active')
  return {
    total: taxRules.length,
    active: active.length,
    highestRate: active.length > 0 ? Math.max(...active.map((rule) => rule.rate)) : null,
  }
}
