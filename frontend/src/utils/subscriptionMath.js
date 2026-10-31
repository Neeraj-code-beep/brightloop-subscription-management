import { BILLING_FREQUENCY_MONTHS, TAX_RATE_PERCENT } from '../constants/subscriptions.js'

export function getLineAmount(line) {
  return line.quantity * line.unitPrice
}

// Prices include tax, so the tax is the portion of the payable total that sits inside it.
export function computeTotals(lines, discountPercent) {
  const subtotal = lines.reduce((sum, line) => sum + getLineAmount(line), 0)
  const discount = Math.round((subtotal * discountPercent) / 100)
  const total = subtotal - discount
  const tax = total - Math.round(total / (1 + TAX_RATE_PERCENT / 100))
  return { subtotal, discount, tax, total }
}

export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addMonthsToISODate(isoDate, months) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return toISODate(new Date(year, month - 1 + months, day))
}

export function addBillingPeriod(isoDate, billingFrequency) {
  return addMonthsToISODate(isoDate, BILLING_FREQUENCY_MONTHS[billingFrequency])
}
