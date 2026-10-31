const inrCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const shortDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatINR(amount) {
  return inrCurrency.format(amount)
}

export function formatDate(isoDate) {
  return shortDate.format(new Date(`${isoDate}T00:00:00`))
}
