import { getCustomerById } from '../data/customers.js'
import { PLAN_OFFER_SETTINGS, PRODUCTS } from '../data/productsPlans.js'
import { getPlanById } from '../data/plans.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'

function buildPlanOffers() {
  return PRODUCTS.flatMap((product) =>
    product.planIds.flatMap((planId) => {
      const plan = getPlanById(planId)
      const settings = PLAN_OFFER_SETTINGS[planId]

      return Object.entries(plan.prices).map(([billingFrequency, salesPrice]) => ({
        id: `${planId}-${billingFrequency}`.toUpperCase(),
        productId: product.id,
        productName: product.name,
        type: product.type,
        planId,
        planName: plan.name,
        billingFrequency,
        salesPrice,
        costPrice: settings.costPrice,
        minQuantity: settings.minQuantity,
        status: settings.status,
        availabilityStart: settings.availabilityStart,
        availabilityEnd: settings.availabilityEnd,
        notes: plan.benefits,
      }))
    }),
  )
}

export const PLAN_OFFERS = buildPlanOffers()

export const PRODUCT_TYPES = [...new Set(PRODUCTS.map((product) => product.type))]

export const PLAN_STATUSES = [...new Set(PLAN_OFFERS.map((offer) => offer.status))]

export const BILLING_FREQUENCIES = [...new Set(PLAN_OFFERS.map((offer) => offer.billingFrequency))]

export const EMPTY_PRODUCT_FILTERS = {
  query: '',
  status: 'all',
  billingFrequency: 'all',
  type: 'all',
}

export function hasActiveProductFilters(filters) {
  return (
    filters.query.trim() !== '' ||
    filters.status !== 'all' ||
    filters.billingFrequency !== 'all' ||
    filters.type !== 'all'
  )
}

export function getOfferAvailability(offer) {
  if (!offer.availabilityStart && !offer.availabilityEnd) return 'Not set'
  return offer.availabilityEnd && offer.availabilityEnd < REFERENCE_DATE ? 'Ended' : 'Available'
}

export function getOfferSubscriptions(subscriptions, offer) {
  return subscriptions.filter(
    (subscription) => subscription.planId === offer.planId && subscription.billingFrequency === offer.billingFrequency,
  )
}

export function getOfferUsage(offer, { subscriptions, invoices, payments }) {
  const related = getOfferSubscriptions(subscriptions, offer)
  const relatedIds = new Set(related.map((subscription) => subscription.id))
  const invoiceNumbers = new Set(
    invoices.filter((invoice) => relatedIds.has(invoice.subscriptionId)).map((invoice) => invoice.number),
  )
  const revenue = payments
    .filter((payment) => invoiceNumbers.has(payment.invoiceNumber))
    .reduce((total, payment) => total + payment.amount, 0)

  return {
    related,
    activeSubscriptions: related.filter((subscription) => subscription.status === 'Active' && !subscription.paused).length,
    revenue,
  }
}

export function summarizePlanOffers(offers) {
  const activePlanIds = new Set(offers.filter((offer) => offer.status === 'Active').map((offer) => offer.planId))

  return {
    products: PRODUCTS.length,
    activePlans: activePlanIds.size,
    monthlyPlans: offers.filter((offer) => offer.billingFrequency === 'Monthly').length,
    quarterlyPlans: offers.filter((offer) => offer.billingFrequency === 'Quarterly').length,
    yearlyPlans: offers.filter((offer) => offer.billingFrequency === 'Yearly').length,
  }
}

export function filterPlanOffers(offers, filters) {
  const query = filters.query.trim().toLowerCase()

  return offers.filter((offer) => {
    if (filters.status !== 'all' && offer.status !== filters.status) return false
    if (filters.billingFrequency !== 'all' && offer.billingFrequency !== filters.billingFrequency) return false
    if (filters.type !== 'all' && offer.type !== filters.type) return false
    if (!query) return true

    return [offer.productName, offer.planName, offer.type].some((value) => value.toLowerCase().includes(query))
  })
}

export function getPlanOfferDetail(offerId, data) {
  const offer = PLAN_OFFERS.find((candidate) => candidate.id === offerId)
  if (!offer) return null

  const usage = getOfferUsage(offer, data)
  const relatedRows = usage.related.map((subscription) => ({
    subscription,
    customerName: getCustomerById(subscription.customerId)?.name ?? 'Unknown customer',
    planName: offer.planName,
  }))

  return { offer, usage, relatedRows }
}
