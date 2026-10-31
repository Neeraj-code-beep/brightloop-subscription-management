export const EMPTY_SUBSCRIPTION_FILTERS = {
  query: '',
  status: 'all',
  frequency: 'all',
  planId: 'all',
}

export function hasActiveSubscriptionFilters(filters) {
  return (
    filters.query.trim() !== '' ||
    filters.status !== 'all' ||
    filters.frequency !== 'all' ||
    filters.planId !== 'all'
  )
}

export function filterSubscriptions(subscriptions, filters, getCustomerName) {
  const query = filters.query.trim().toLowerCase()

  return subscriptions.filter((subscription) => {
    if (filters.status !== 'all' && subscription.status !== filters.status) return false
    if (filters.frequency !== 'all' && subscription.billingFrequency !== filters.frequency) return false
    if (filters.planId !== 'all' && subscription.planId !== filters.planId) return false
    if (!query) return true

    return (
      subscription.id.toLowerCase().includes(query) ||
      getCustomerName(subscription.customerId).toLowerCase().includes(query)
    )
  })
}

export function findCustomerSubscription(subscriptions, customerId) {
  return subscriptions.find((subscription) => subscription.customerId === customerId) ?? null
}
