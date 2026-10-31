export const INVOICE_STATUSES = ['Draft', 'Confirmed', 'Paid', 'Overdue']

export const PAYMENT_METHODS = ['UPI', 'Bank transfer', 'Credit card', 'Cheque', 'Cash']

export const INVOICE_NUMBER_PREFIX = 'BL-2026-'

export const PAYMENT_ID_PREFIX = 'PAY-'

export const PAYMENT_STATUS = 'Captured'

export const PAYMENT_TERM_DAYS = {
  'Due on receipt': 0,
  'Net 7': 7,
  'Net 15': 15,
  'Net 30': 30,
}

export const INVOICE_ISSUED_FILTERS = [
  { value: 'all', label: 'All time' },
  { value: 'this-month', label: 'Issued this month' },
  { value: 'last-90', label: 'Last 90 days' },
]

export const BRIGHTLOOP_BILLING_NAME = 'Brightloop Software'
