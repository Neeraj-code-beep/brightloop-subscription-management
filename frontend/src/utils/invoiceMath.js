import { PAYMENT_TERM_DAYS } from '../constants/invoices.js'
import { REFERENCE_DATE, TAX_RATE_PERCENT } from '../constants/subscriptions.js'
import { toISODate } from './subscriptionMath.js'

// Prices include tax, so the rule discount is spread across lines and tax is backed out of each line's payable amount.
export function computeInvoiceLines(lines, discountPercent, { ruleDiscount = 0, taxRate = 0 } = {}) {
  const priced = lines.map((line) => {
    const amount = line.quantity * line.unitPrice
    const subscriptionDiscount = Math.round((amount * discountPercent) / 100)
    return { amount, subscriptionDiscount, afterSubscription: amount - subscriptionDiscount }
  })
  const afterSubscriptionTotal = priced.reduce((sum, line) => sum + line.afterSubscription, 0)

  let allocated = 0
  return priced.map((line, index) => {
    const isLast = index === priced.length - 1
    const ruleShare = isLast
      ? ruleDiscount - allocated
      : afterSubscriptionTotal === 0
        ? 0
        : Math.floor((ruleDiscount * line.afterSubscription) / afterSubscriptionTotal)
    allocated += ruleShare

    const net = line.afterSubscription - ruleShare
    const tax = net - Math.round(net / (1 + taxRate / 100))
    return { amount: line.amount, subscriptionDiscount: line.subscriptionDiscount, ruleShare, net, tax }
  })
}

export function computeInvoiceTotals(lines, discountPercent, options = {}) {
  const rows = computeInvoiceLines(lines, discountPercent, options)
  const totals = rows.reduce(
    (sum, row) => ({
      subtotal: sum.subtotal + row.amount,
      discount: sum.discount + row.subscriptionDiscount,
      ruleDiscount: sum.ruleDiscount + row.ruleShare,
      tax: sum.tax + row.tax,
      total: sum.total + row.net,
    }),
    { subtotal: 0, discount: 0, ruleDiscount: 0, tax: 0, total: 0 },
  )
  return { ...totals, taxable: totals.total - totals.tax }
}

const LEGACY_TAX_RECORD = { id: null, name: `GST ${TAX_RATE_PERCENT}%`, rate: TAX_RATE_PERCENT, amount: null }

// Invoices issued before tax rules existed have no tax field; their tax stays at the original 18% rate.
export function getInvoiceTaxRecord(invoice) {
  return 'tax' in invoice ? invoice.tax : LEGACY_TAX_RECORD
}

export function getInvoicePricing(invoice) {
  const taxRecord = getInvoiceTaxRecord(invoice)
  return {
    taxRecord,
    lines: invoice.lines,
    discountPercent: invoice.discountPercent,
    options: { ruleDiscount: invoice.discount?.amount ?? 0, taxRate: taxRecord?.rate ?? 0 },
  }
}

export function getInvoiceTotals(invoice) {
  const { taxRecord, lines, discountPercent, options } = getInvoicePricing(invoice)
  return { ...computeInvoiceTotals(lines, discountPercent, options), taxRecord }
}

export function addDaysToISODate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return toISODate(new Date(year, month - 1, day + days))
}

export function dueDateForTerms(issueDate, paymentTerms) {
  return addDaysToISODate(issueDate, PAYMENT_TERM_DAYS[paymentTerms])
}

export function daysBetween(fromIsoDate, toIsoDate) {
  const from = new Date(`${fromIsoDate}T00:00:00`)
  const to = new Date(`${toIsoDate}T00:00:00`)
  return Math.round((to - from) / 86400000)
}

export function resolveInvoiceStatus(invoice) {
  if (invoice.status === 'Confirmed' && invoice.dueDate < REFERENCE_DATE) return 'Overdue'
  return invoice.status
}

export function isPaymentPendingCollection(invoice) {
  const status = resolveInvoiceStatus(invoice)
  return status === 'Confirmed' || status === 'Overdue'
}
