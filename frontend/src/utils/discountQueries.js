import { PLANS, getPlanById } from '../data/plans.js'
import { PRODUCTS } from '../data/productsPlans.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'
import { formatDate, formatINR } from './format.js'
import { computeInvoiceTotals } from './invoiceMath.js'
import { getLineAmount } from './subscriptionMath.js'

const EXPIRING_SOON_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export const DISCOUNT_STATUSES = ['Active', 'Scheduled', 'Expired', 'Usage limit reached']
export const DISCOUNT_TYPES = ['Percentage', 'Fixed']
export const APPLIES_TO_ALL = 'subscriptions'
export const DISCOUNT_SCOPES = [
  { value: 'subscriptions', label: 'All subscriptions' },
  { value: 'product', label: 'Specific product' },
  { value: 'plan', label: 'Specific plan' },
]

export const EMPTY_DISCOUNT_FILTERS = {
  query: '',
  status: 'all',
  type: 'all',
  scope: 'all',
}

function daysBetween(fromIsoDate, toIsoDate) {
  return Math.round((Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / MS_PER_DAY)
}

export function getDiscountStatus(discount) {
  if (discount.startDate > REFERENCE_DATE) return 'Scheduled'
  if (discount.endDate && discount.endDate < REFERENCE_DATE) return 'Expired'
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) return 'Usage limit reached'
  return 'Active'
}

function getAppliesToLabel(appliesTo) {
  if (appliesTo.kind === 'product') {
    return PRODUCTS.find((product) => product.id === appliesTo.productId)?.name ?? 'Unknown product'
  }
  if (appliesTo.kind === 'plan') {
    return `${getPlanById(appliesTo.planId)?.name ?? 'Unknown'} plan`
  }
  return 'All subscriptions'
}

function getValidityHint(discount, status) {
  if (status === 'Scheduled') return `Starts in ${daysBetween(REFERENCE_DATE, discount.startDate)} days`
  if (status === 'Expired') return `Ended ${daysBetween(discount.endDate, REFERENCE_DATE)} days ago`
  if (!discount.endDate) return 'Open-ended'
  return `Ends in ${daysBetween(REFERENCE_DATE, discount.endDate)} days`
}

function isExpiringSoon(discount, status) {
  if (status !== 'Active' || !discount.endDate) return false
  const remaining = daysBetween(REFERENCE_DATE, discount.endDate)
  return remaining >= 0 && remaining <= EXPIRING_SOON_DAYS
}

export function getAppliesToGroups() {
  return [
    {
      label: 'Products',
      options: PRODUCTS.map((product) => ({ value: `product:${product.id}`, label: product.name })),
    },
    {
      label: 'Plans',
      options: PLANS.map((plan) => ({ value: `plan:${plan.id}`, label: plan.name })),
    },
  ]
}

export function formatDiscountValue(discount) {
  return discount.type === 'Percentage' ? `${discount.value}%` : formatINR(discount.value)
}

export function buildDiscountRows(discounts) {
  return discounts.map((discount) => {
    const status = getDiscountStatus(discount)

    return {
      discount,
      status,
      valueLabel: formatDiscountValue(discount),
      appliesToLabel: getAppliesToLabel(discount.appliesTo),
      scope: discount.appliesTo.kind,
      validityLabel: `${formatDate(discount.startDate)} – ${discount.endDate ? formatDate(discount.endDate) : 'No end date'}`,
      validityHint: getValidityHint(discount, status),
      usageLabel: `${discount.usedCount} / ${discount.usageLimit ?? 'Unlimited'}`,
      expiringSoon: isExpiringSoon(discount, status),
    }
  })
}

export function summarizeDiscountRows(rows) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'Active').length,
    expiringSoon: rows.filter((row) => row.expiringSoon).length,
    usageLimited: rows.filter((row) => row.discount.usageLimit !== null).length,
  }
}

export function hasActiveDiscountFilters(filters) {
  return (
    filters.query.trim() !== '' || filters.status !== 'all' || filters.type !== 'all' || filters.scope !== 'all'
  )
}

export function filterDiscountRows(rows, filters) {
  const query = filters.query.trim().toLowerCase()

  return rows.filter(({ discount, status, scope }) => {
    if (filters.status !== 'all' && status !== filters.status) return false
    if (filters.type !== 'all' && discount.type !== filters.type) return false
    if (filters.scope !== 'all' && scope !== filters.scope) return false
    if (!query) return true

    return discount.name.toLowerCase().includes(query) || discount.code.toLowerCase().includes(query)
  })
}

function getProductIdForPlan(planId) {
  return PRODUCTS.find((product) => product.planIds.includes(planId))?.id ?? null
}

function appliesToSubscription(discount, subscription) {
  const { appliesTo } = discount
  if (appliesTo.kind === 'subscriptions') return true
  if (appliesTo.kind === 'product') return getProductIdForPlan(subscription.planId) === appliesTo.productId
  return subscription.planId === appliesTo.planId
}

function isEligibleForInvoice(discount, subscription, { subtotal, quantity, issueDate }) {
  if (getDiscountStatus(discount) !== 'Active') return false
  if (discount.startDate > issueDate) return false
  if (discount.endDate && discount.endDate < issueDate) return false
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) return false
  if (!appliesToSubscription(discount, subscription)) return false
  if (discount.minPurchaseAmount !== null && subtotal < discount.minPurchaseAmount) return false
  if (discount.minQuantity !== null && quantity < discount.minQuantity) return false
  return true
}

function calculateInvoiceDiscountAmount(discount, subtotal, payableCap) {
  const calculated = discount.type === 'Percentage' ? Math.round((subtotal * discount.value) / 100) : discount.value
  return Math.min(calculated, payableCap)
}

export function selectInvoiceDiscount(discounts, subscription, issueDate) {
  const subtotal = subscription.lines.reduce((sum, line) => sum + getLineAmount(line), 0)
  const quantity = subscription.lines.reduce((sum, line) => sum + line.quantity, 0)
  const payableCap = computeInvoiceTotals(subscription.lines, subscription.discountPercent).total

  const candidates = discounts
    .map((discount, index) => ({ discount, index }))
    .filter(({ discount }) => isEligibleForInvoice(discount, subscription, { subtotal, quantity, issueDate }))
    .map((candidate) => ({
      ...candidate,
      amount: calculateInvoiceDiscountAmount(candidate.discount, subtotal, payableCap),
    }))
    .filter(({ amount }) => amount > 0)

  if (candidates.length === 0) return null

  candidates.sort(
    (a, b) =>
      b.amount - a.amount ||
      a.discount.startDate.localeCompare(b.discount.startDate) ||
      a.index - b.index,
  )

  const { discount, amount } = candidates[0]
  return { id: discount.id, code: discount.code, name: discount.name, type: discount.type, value: discount.value, amount }
}
