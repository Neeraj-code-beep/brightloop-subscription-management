import { BILLING_FREQUENCY_MONTHS, REFERENCE_DATE } from '../constants/subscriptions.js'
import { getCustomerById } from '../data/customers.js'
import { getInvoiceTotals, resolveInvoiceStatus } from './invoiceMath.js'
import { summarizeInvoices } from './invoiceQueries.js'
import { computeTotals } from './subscriptionMath.js'
import { paidAmountFor } from './paymentQueries.js'

export const REPORT_PERIODS = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

export const REPORT_INVOICE_STATUSES = ['Confirmed', 'Overdue', 'Paid']

export const EMPTY_REPORT_FILTERS = { period: '6', status: 'all', method: 'all', product: 'all' }

const ALL_TIME_TREND_MONTHS = 12
const EXPIRING_WINDOW_DAYS = 90

function monthKeys(count) {
  const [year, month] = REFERENCE_DATE.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1))
    return date.toISOString().slice(0, 7)
  })
}

function periodKeys(period) {
  return period === 'all' ? null : monthKeys(Number(period))
}

function productMatches(invoice, product) {
  return product === 'all' || invoice.lines.some((line) => line.productName === product)
}

export function getProductOptions(invoices) {
  return [...new Set(invoices.flatMap((invoice) => invoice.lines.map((line) => line.productName)))].sort()
}

export function getMethodOptions(payments) {
  return [...new Set(payments.map((payment) => payment.method))].sort()
}

export function filterReportInvoices(invoices, filters) {
  const keys = periodKeys(filters.period)
  return invoices.filter((invoice) => {
    if (keys && !keys.includes(invoice.issueDate.slice(0, 7))) return false
    if (filters.status !== 'all' && resolveInvoiceStatus(invoice) !== filters.status) return false
    return productMatches(invoice, filters.product)
  })
}

export function filterReportPayments(payments, invoices, filters) {
  const keys = periodKeys(filters.period)
  const invoicesInProduct = new Set(
    invoices.filter((invoice) => productMatches(invoice, filters.product)).map((invoice) => invoice.number),
  )
  return payments.filter((payment) => {
    if (keys && !keys.includes(payment.date.slice(0, 7))) return false
    if (filters.method !== 'all' && payment.method !== filters.method) return false
    return filters.product === 'all' || invoicesInProduct.has(payment.invoiceNumber)
  })
}

export function getActiveSubscriptions(subscriptions) {
  return subscriptions.filter((subscription) => subscription.status === 'Active')
}

export function getBillableSubscriptions(subscriptions) {
  return getActiveSubscriptions(subscriptions).filter((subscription) => !subscription.paused)
}

export function getMonthlyRecurringRevenue(subscriptions) {
  return getBillableSubscriptions(subscriptions).reduce((total, subscription) => {
    const cycleAmount = computeTotals(subscription.lines, subscription.discountPercent).total
    return total + Math.round(cycleAmount / BILLING_FREQUENCY_MONTHS[subscription.billingFrequency])
  }, 0)
}

export function getActiveCustomerCount(subscriptions) {
  return new Set(getActiveSubscriptions(subscriptions).map((subscription) => subscription.customerId)).size
}

export function getSubscriptionSummary(subscriptions) {
  const windowEnd = new Date(`${REFERENCE_DATE}T00:00:00Z`)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + EXPIRING_WINDOW_DAYS)
  const windowEndKey = windowEnd.toISOString().slice(0, 10)

  return {
    active: getActiveSubscriptions(subscriptions).length,
    paused: subscriptions.filter((subscription) => subscription.status === 'Active' && subscription.paused).length,
    pending: subscriptions.filter((subscription) => ['Draft', 'Quotation', 'Confirmed'].includes(subscription.status))
      .length,
    expiringSoon: getActiveSubscriptions(subscriptions).filter(
      (subscription) => subscription.expiryDate >= REFERENCE_DATE && subscription.expiryDate <= windowEndKey,
    ).length,
    monthlyRecurringRevenue: getMonthlyRecurringRevenue(subscriptions),
    activeCustomers: getActiveCustomerCount(subscriptions),
  }
}

function billedInvoices(invoices) {
  return invoices.filter((invoice) => resolveInvoiceStatus(invoice) !== 'Draft')
}

export function getBilledAmount(invoices) {
  return billedInvoices(invoices).reduce((total, invoice) => total + getInvoiceTotals(invoice).total, 0)
}

export function getMonthlyRevenue(invoices, payments, filters) {
  const months = periodKeys(filters.period) ?? monthKeys(ALL_TIME_TREND_MONTHS)
  const billed = filterReportInvoices(invoices, { ...filters, period: 'all' })
  const collected = filterReportPayments(payments, invoices, { ...filters, period: 'all' })

  return months.map((key) => ({
    key,
    label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    billed: billedInvoices(billed)
      .filter((invoice) => invoice.issueDate.startsWith(key))
      .reduce((total, invoice) => total + getInvoiceTotals(invoice).total, 0),
    collected: collected
      .filter((payment) => payment.date.startsWith(key))
      .reduce((total, payment) => total + payment.amount, 0),
  }))
}

export function getRevenueByProduct(invoices, filters) {
  const totals = new Map()

  billedInvoices(filterReportInvoices(invoices, filters)).forEach((invoice) => {
    const invoiceTotal = getInvoiceTotals(invoice).total
    const baseTotal = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    invoice.lines.forEach((line) => {
      if (filters.product !== 'all' && line.productName !== filters.product) return
      const share = baseTotal > 0 ? (line.quantity * line.unitPrice) / baseTotal : 0
      totals.set(line.productName, (totals.get(line.productName) ?? 0) + invoiceTotal * share)
    })
  })

  return [...totals.entries()]
    .map(([productName, amount]) => ({ productName, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
}

export function getOpenInvoiceRows(invoices, payments, filters) {
  return filterReportInvoices(invoices, filters)
    .filter((invoice) => ['Confirmed', 'Overdue'].includes(resolveInvoiceStatus(invoice)))
    .map((invoice) => {
      const total = getInvoiceTotals(invoice).total
      const paid = paidAmountFor(payments, invoice.number)
      return {
        invoice,
        status: resolveInvoiceStatus(invoice),
        customerName: getCustomerById(invoice.customerId)?.name ?? 'Unknown customer',
        balance: total - paid,
      }
    })
    .sort((a, b) => b.balance - a.balance)
}

export function getReportSummary({ subscriptions, invoices, payments }, filters) {
  const filteredInvoices = filterReportInvoices(invoices, filters)
  const filteredPayments = filterReportPayments(payments, invoices, filters)
  const invoiceSummary = summarizeInvoices(filteredInvoices, payments)

  return {
    ...getSubscriptionSummary(subscriptions),
    revenue: getBilledAmount(filteredInvoices),
    collected: filteredPayments.reduce((total, payment) => total + payment.amount, 0),
    outstanding: invoiceSummary.outstanding.amount,
    openCount: invoiceSummary.outstanding.count,
    overdueCount: invoiceSummary.overdue.count,
    paidCount: filteredInvoices.filter((invoice) => resolveInvoiceStatus(invoice) === 'Paid').length,
  }
}

export function getRecentInvoiceRows(invoices, limit) {
  return [...invoices]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, limit)
    .map((invoice) => ({
      id: invoice.number,
      customer: getCustomerById(invoice.customerId)?.name ?? 'Unknown customer',
      amount: getInvoiceTotals(invoice).total,
      dueDate: invoice.dueDate,
      status: resolveInvoiceStatus(invoice),
    }))
}

export function getRecentPaymentRows(payments, invoices, filters, limit) {
  return filterReportPayments(payments, invoices, filters)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((payment) => ({
      payment,
      customerName: getCustomerById(payment.customerId)?.name ?? 'Unknown customer',
    }))
}
