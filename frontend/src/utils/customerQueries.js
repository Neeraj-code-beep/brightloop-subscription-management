import { CUSTOMERS, getCustomerById } from '../data/customers.js'
import { getPlanById } from '../data/plans.js'
import { getCustomerEmail } from './customerContact.js'
import { getInvoiceTotals, isPaymentPendingCollection, resolveInvoiceStatus } from './invoiceMath.js'
import { getCustomerInvoices, toInvoiceRow } from './invoiceQueries.js'
import { getCustomerPayments, paidAmountFor, toPaymentRow } from './paymentQueries.js'
import { findCustomerSubscription } from './subscriptionQueries.js'
import { computeTotals } from './subscriptionMath.js'

const RECENT_LIMIT = 5
const NO_SUBSCRIPTION = 'No subscription'

export const CUSTOMER_STATUS_FILTERS = ['Active', 'Paused', 'Confirmed', 'Closed', NO_SUBSCRIPTION]

export const EMPTY_CUSTOMER_FILTERS = {
  query: '',
  status: 'all',
}

export function hasActiveCustomerFilters(filters) {
  return filters.query.trim() !== '' || filters.status !== 'all'
}

function describeSubscription(subscription) {
  if (!subscription) return null

  return {
    id: subscription.id,
    status: subscription.paused && subscription.status === 'Active' ? 'Paused' : subscription.status,
    planName: getPlanById(subscription.planId)?.name ?? '—',
    billingFrequency: subscription.billingFrequency,
    amount: computeTotals(subscription.lines, subscription.discountPercent).total,
    startDate: subscription.startDate,
    nextBillingDate: subscription.nextBillingDate ?? null,
  }
}

function summarizeBilling(customerId, invoices, payments) {
  const customerInvoices = getCustomerInvoices(invoices, customerId)
  const billed = customerInvoices
    .filter((invoice) => resolveInvoiceStatus(invoice) !== 'Draft')
    .reduce((total, invoice) => total + getInvoiceTotals(invoice).total, 0)
  const paid = getCustomerPayments(payments, customerId).reduce((total, payment) => total + payment.amount, 0)

  return customerInvoices.reduce(
    (summary, invoice) => {
      if (!isPaymentPendingCollection(invoice)) return summary
      const balance = getInvoiceTotals(invoice).total - paidAmountFor(payments, invoice.number)
      return {
        ...summary,
        openInvoices: summary.openInvoices + 1,
        outstanding: summary.outstanding + balance,
      }
    },
    { billed, paid, outstanding: 0, openInvoices: 0 },
  )
}

export function getCustomerSummary(customer, { subscriptions, invoices, payments }) {
  const subscription = findCustomerSubscription(subscriptions, customer.id)

  return {
    customer,
    email: getCustomerEmail(customer.id),
    subscription: describeSubscription(subscription),
    customerSince: subscription?.startDate ?? null,
    billing: summarizeBilling(customer.id, invoices, payments),
  }
}

export function buildCustomerSummaries(data) {
  return CUSTOMERS.map((customer) => getCustomerSummary(customer, data))
}

export function summarizeCustomers(summaries) {
  return summaries.reduce(
    (totals, summary) => ({
      total: totals.total + 1,
      activeSubscriptions: totals.activeSubscriptions + (summary.subscription?.status === 'Active' ? 1 : 0),
      outstanding: totals.outstanding + summary.billing.outstanding,
      openInvoices: totals.openInvoices + summary.billing.openInvoices,
    }),
    { total: 0, activeSubscriptions: 0, outstanding: 0, openInvoices: 0 },
  )
}

export function filterCustomerSummaries(summaries, filters) {
  const query = filters.query.trim().toLowerCase()

  return summaries.filter((summary) => {
    if (filters.status !== 'all' && getCustomerStatusLabel(summary) !== filters.status) return false
    if (!query) return true

    const { customer, email } = summary
    return [customer.name, customer.contact, customer.city, customer.id, email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })
}

export function getCustomerStatusLabel(summary) {
  return summary.subscription?.status ?? NO_SUBSCRIPTION
}

export function getCustomerDetail(customerId, data) {
  const customer = getCustomerById(customerId)
  if (!customer) return null

  const summary = getCustomerSummary(customer, data)
  const recentInvoices = [...getCustomerInvoices(data.invoices, customerId)]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, RECENT_LIMIT)
    .map(toInvoiceRow)
  const recentPayments = getCustomerPayments(data.payments, customerId).slice(0, RECENT_LIMIT).map(toPaymentRow)

  return { ...summary, recentInvoices, recentPayments }
}
