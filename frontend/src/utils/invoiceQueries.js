import { getCustomerById } from '../data/customers.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'
import { getInvoiceTotals, addDaysToISODate, resolveInvoiceStatus } from './invoiceMath.js'
import { paidAmountFor } from './paymentQueries.js'
import { canGenerateInvoice } from '../services/subscriptionLifecycleService.js'

export function toInvoiceRow(invoice) {
  return {
    invoice,
    customerName: getCustomerById(invoice.customerId)?.name ?? 'Unknown customer',
    total: getInvoiceTotals(invoice).total,
    status: resolveInvoiceStatus(invoice),
  }
}

export const EMPTY_INVOICE_FILTERS = {
  query: '',
  status: 'all',
  issued: 'all',
}

export function hasActiveInvoiceFilters(filters) {
  return filters.query.trim() !== '' || filters.status !== 'all' || filters.issued !== 'all'
}

function matchesIssuedFilter(invoice, issued) {
  if (issued === 'this-month') return invoice.issueDate.startsWith(REFERENCE_DATE.slice(0, 7))
  if (issued === 'last-90') return invoice.issueDate >= addDaysToISODate(REFERENCE_DATE, -90)
  return true
}

export function filterInvoices(invoices, filters, getCustomerName) {
  const query = filters.query.trim().toLowerCase()

  return invoices.filter((invoice) => {
    if (filters.status !== 'all' && resolveInvoiceStatus(invoice) !== filters.status) return false
    if (!matchesIssuedFilter(invoice, filters.issued)) return false
    if (!query) return true

    return (
      invoice.number.toLowerCase().includes(query) ||
      invoice.subscriptionId.toLowerCase().includes(query) ||
      getCustomerName(invoice.customerId).toLowerCase().includes(query)
    )
  })
}

export function getCustomerInvoices(invoices, customerId) {
  return invoices.filter((invoice) => invoice.customerId === customerId)
}

export function getBillableSubscriptions(subscriptions) {
  return subscriptions.filter(canGenerateInvoice)
}

export function summarizeInvoices(invoices, payments) {
  const currentMonth = REFERENCE_DATE.slice(0, 7)
  const summary = {
    total: invoices.length,
    outstanding: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    paidThisMonth: { count: 0, amount: 0 },
  }

  invoices.forEach((invoice) => {
    const status = resolveInvoiceStatus(invoice)
    if (status !== 'Confirmed' && status !== 'Overdue') return

    const balance = getInvoiceTotals(invoice).total - paidAmountFor(payments, invoice.number)
    summary.outstanding.count += 1
    summary.outstanding.amount += balance
    if (status === 'Overdue') {
      summary.overdue.count += 1
      summary.overdue.amount += balance
    }
  })

  payments.forEach((payment) => {
    if (!payment.date.startsWith(currentMonth)) return
    summary.paidThisMonth.count += 1
    summary.paidThisMonth.amount += payment.amount
  })

  return summary
}
