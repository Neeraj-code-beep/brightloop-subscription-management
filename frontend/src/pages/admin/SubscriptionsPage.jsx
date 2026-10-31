import { Plus, SearchX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import SubscriptionFilters from '../../components/subscriptions/SubscriptionFilters.jsx'
import SubscriptionForm from '../../components/subscriptions/SubscriptionForm.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import SubscriptionTable from '../../components/subscriptions/SubscriptionTable.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { getCustomerById } from '../../data/customers.js'
import { getPlanById, PLANS } from '../../data/plans.js'
import useSubscriptions from '../../hooks/useSubscriptions.js'
import useToast from '../../hooks/useToast.js'
import { formatINR } from '../../utils/format.js'
import { getSubscriptionSummary } from '../../utils/reportQueries.js'
import {
  EMPTY_SUBSCRIPTION_FILTERS,
  filterSubscriptions,
  hasActiveSubscriptionFilters,
} from '../../utils/subscriptionQueries.js'

function getCustomerName(customerId) {
  return getCustomerById(customerId)?.name ?? 'Unknown customer'
}

export default function SubscriptionsPage() {
  const { subscriptions, createSubscription } = useSubscriptions()
  const { showToast } = useToast()
  const [filters, setFilters] = useState(EMPTY_SUBSCRIPTION_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)
  const summary = useMemo(() => getSubscriptionSummary(subscriptions), [subscriptions])
  const summaryStats = [
    { label: 'Active', value: summary.active.toLocaleString('en-IN') },
    { label: 'Paused', value: summary.paused.toLocaleString('en-IN') },
    { label: 'Expiring soon', value: summary.expiringSoon.toLocaleString('en-IN') },
    { label: 'Monthly recurring revenue', value: formatINR(summary.monthlyRecurringRevenue) },
  ]

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const visibleSubscriptions = useMemo(
    () => filterSubscriptions(subscriptions, filters, getCustomerName),
    [subscriptions, filters],
  )

  const rows = visibleSubscriptions.map((subscription) => ({
    subscription,
    customerName: getCustomerName(subscription.customerId),
    planName: getPlanById(subscription.planId)?.name ?? '—',
  }))

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  function handleCreate(input) {
    const created = createSubscription(input)
    setFilters(EMPTY_SUBSCRIPTION_FILTERS)
    setCreateOpen(false)
    showToast({
      title: `Subscription ${created.id} created`,
      description: `${getCustomerName(created.customerId)} is saved as a draft and listed at the top.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage active plans, renewals, and subscription lifecycle."
        action={
          <button type="button" onClick={() => setCreateOpen(true)} className={buttonVariants({ variant: 'primary' })}>
            <Plus size={16} aria-hidden="true" />
            New Subscription
          </button>
        }
      />

      <StatStrip stats={summaryStats} ariaLabel="Subscription summary" />

      <div className="space-y-4">
        <SubscriptionFilters
          filters={filters}
          plans={PLANS}
          onChange={updateFilter}
          onClear={() => setFilters(EMPTY_SUBSCRIPTION_FILTERS)}
        />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {subscriptions.length} subscriptions
        </p>

        {rows.length > 0 ? (
          <SubscriptionTable rows={rows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No subscriptions match these filters"
              description="Try a different search term or clear the filters to see every subscription."
              action={
                hasActiveSubscriptionFilters(filters) && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_SUBSCRIPTION_FILTERS)}
                    className={buttonVariants({ variant: 'secondary' })}
                  >
                    Clear filters
                  </button>
                )
              }
            />
          </Card>
        )}
      </div>

      <Modal open={createOpen} onClose={closeCreate} size="lg" title="New Subscription" description="Create a draft subscription. Move it to a quotation when it is ready.">
        <SubscriptionForm mode="create" onSubmit={handleCreate} onCancel={closeCreate} />
      </Modal>
    </div>
  )
}
