import { PAYMENT_STATUS } from '../constants/invoices.js'
import { getCustomerById } from '../data/customers.js'

export const EMPTY_PAYMENT_FILTERS = {
  query: '',
  method: 'all',
}

export function hasActivePaymentFilters(filters) {
  return filters.query.trim() !== '' || filters.method !== 'all'
}

function customerNameFor(customerId) {
  return getCustomerById(customerId)?.name ?? 'Unknown customer'
}

function newestFirst(payments) {
  return [...payments].sort((a, b) => b.date.localeCompare(a.date))
}

export function getPaymentsForInvoice(payments, invoiceNumber) {
  return newestFirst(payments.filter((payment) => payment.invoiceNumber === invoiceNumber))
}

export function getCustomerPayments(payments, customerId) {
  return newestFirst(payments.filter((payment) => payment.customerId === customerId))
}

export function paidAmountFor(payments, invoiceNumber) {
  return payments
    .filter((payment) => payment.invoiceNumber === invoiceNumber)
    .reduce((total, payment) => total + payment.amount, 0)
}

export function filterPayments(payments, filters) {
  const query = filters.query.trim().toLowerCase()

  return newestFirst(
    payments.filter((payment) => {
      if (filters.method !== 'all' && payment.method !== filters.method) return false
      if (!query) return true

      return (
        payment.id.toLowerCase().includes(query) ||
        payment.invoiceNumber.toLowerCase().includes(query) ||
        customerNameFor(payment.customerId).toLowerCase().includes(query)
      )
    }),
  )
}

export function summarizePayments(payments) {
  return payments.reduce(
    (summary, payment) => ({ count: summary.count + 1, amount: summary.amount + payment.amount }),
    { count: 0, amount: 0 },
  )
}

export function toPaymentRow(payment) {
  return { payment, customerName: customerNameFor(payment.customerId) }
}

export function toPaymentListItem(payment) {
  return {
    id: payment.id,
    customer: customerNameFor(payment.customerId),
    amount: payment.amount,
    method: payment.method,
    date: payment.date,
    status: PAYMENT_STATUS,
  }
}
