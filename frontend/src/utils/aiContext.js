import { ROLES } from '../constants/roles.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'
import { CUSTOMERS, getCustomerById } from '../data/customers.js'
import { PLANS, getPlanById } from '../data/plans.js'
import { getCustomerInvoices, toInvoiceRow } from '../utils/invoiceQueries.js'
import { getCustomerPayments, paidAmountFor } from '../utils/paymentQueries.js'
import { getMonthlyRecurringRevenue } from '../utils/reportQueries.js'
import { findCustomerSubscription } from '../utils/subscriptionQueries.js'

const MONTHS_PER_CYCLE = { Monthly: 1, Quarterly: 3, Yearly: 12 }
const DAY_MS = 86400000

function daysBetween(fromISO, toISO) {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / DAY_MS)
}

function toPaymentRecord(payment) {
  return {
    id: payment.id,
    invoiceNumber: payment.invoiceNumber,
    customerId: payment.customerId,
    customerName: getCustomerById(payment.customerId)?.name ?? 'Unknown customer',
    date: payment.date,
    method: payment.method,
    amount: payment.amount,
  }
}

function toInvoiceRecord(invoice, payments) {
  const { customerName, total, status } = toInvoiceRow(invoice)
  const paid = paidAmountFor(payments, invoice.number)
  return {
    number: invoice.number,
    customerId: invoice.customerId,
    customerName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    total,
    paid,
    balance: total - paid,
    status,
    daysPastDue: status === 'Overdue' ? daysBetween(invoice.dueDate, REFERENCE_DATE) : 0,
  }
}

function toSubscriptionRecord(subscription, includePricing) {
  const plan = getPlanById(subscription.planId) || { name: 'Standard' }
  const record = {
    id: subscription.id,
    customerId: subscription.customerId,
    customerName: getCustomerById(subscription.customerId)?.name ?? 'Unknown customer',
    planName: plan.name,
    status: subscription.status,
    billingFrequency: subscription.billingFrequency,
    nextBillingDate: subscription.nextBillingDate,
  }
  if (!includePricing) return record

  const amountPerCycle = (subscription.lines || []).reduce((total, line) => total + line.unitPrice * line.quantity, 0)
  return {
    ...record,
    amountPerCycle,
    monthlyValue: Math.round(amountPerCycle / (MONTHS_PER_CYCLE[subscription.billingFrequency] || 1)),
  }
}

function buildCustomerContext({ user, subscriptions, invoices, payments }) {
  const ownPayments = getCustomerPayments(payments, user.customerId)
  const ownSubscription = findCustomerSubscription(subscriptions, user.customerId)

  return {
    scope: ROLES.CUSTOMER,
    currentCustomerId: user.customerId,
    customerId: user.customerId,
    customerName: getCustomerById(user.customerId)?.name ?? user.name,
    subscriptions: ownSubscription ? [toSubscriptionRecord(ownSubscription, true)] : [],
    invoices: getCustomerInvoices(invoices, user.customerId).map((invoice) => toInvoiceRecord(invoice, ownPayments)),
    payments: ownPayments.map(toPaymentRecord),
  }
}

function buildBusinessContext({ role, user, subscriptions, invoices, payments }) {
  const includePricing = role === ROLES.ADMIN
  const subscriptionRecords = subscriptions.map((subscription) => toSubscriptionRecord(subscription, includePricing))

  const context = {
    scope: role,
    currentCustomerId: user?.customerId || null,
    customers: CUSTOMERS.map(({ id, name }) => ({ id, name })),
    subscriptions: subscriptionRecords,
    invoices: invoices.map((invoice) => toInvoiceRecord(invoice, payments)),
    payments: payments.map(toPaymentRecord),
  }
  if (role !== ROLES.ADMIN) return context

  return {
    ...context,
    plans: PLANS.map(({ id, name, productName, prices }) => ({
      id,
      name,
      productName,
      monthlyPrice: prices.Monthly,
    })),
    mrr: getMonthlyRecurringRevenue(subscriptions),
  }
}

export function buildAIContext({ role, user, subscriptions, invoices, payments }) {
  if (role === ROLES.CUSTOMER) return buildCustomerContext({ user, subscriptions, invoices, payments })
  return buildBusinessContext({ role, user, subscriptions, invoices, payments })
}
