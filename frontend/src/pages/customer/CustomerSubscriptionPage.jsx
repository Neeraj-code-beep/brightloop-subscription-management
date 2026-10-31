import React, { useEffect, useState, useCallback } from 'react'
import { Check, Repeat } from 'lucide-react'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import SubscriptionDetail from '../../components/subscriptions/SubscriptionDetail.jsx'
import SubscriptionStatusBadge from '../../components/subscriptions/SubscriptionStatusBadge.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import useAuth from '../../hooks/useAuth.js'
import customerService from '../../services/customerService.js'
import { formatDate, formatINR } from '../../utils/format.js'

export default function CustomerSubscriptionPage() {
  const { user, customerId } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadSubscriptions = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await customerService.getSubscriptions(customerId)
      const list = Array.isArray(res) ? res : res?.subscriptions || []
      setSubscriptions(list)
    } catch (err) {
      console.warn('Failed to load subscriptions:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  const subscription = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0]

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Subscription" description="Loading subscription details..." />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-muted" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader title="My Subscription" description="Your current plan and renewal" />
        <Card>
          <EmptyState
            icon={Repeat}
            title="No subscription yet"
            description="When your plan is set up, its details and renewal date will appear here."
          />
        </Card>
      </div>
    )
  }

  const customerName = user?.name || 'Customer'
  const planName = subscription.plan?.name || 'Standard Plan'
  const recurringAmount = Number(subscription.recurringPrice || 0)
  const isClosed = subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED'

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="My Subscription"
        description="Your current plan and renewal"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              View details
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-foreground-muted">Current plan</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{planName}</p>
              <p className="text-sm text-foreground-muted">
                {subscription.subscriptionNumber || subscription.id} · {subscription.billingCycle || 'Monthly'}
              </p>
            </div>
            <SubscriptionStatusBadge status={subscription.status} paused={subscription.status === 'PAUSED'} />
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-5 border-t border-border pt-5 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Amount per cycle
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground">
                {formatINR(recurringAmount)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Next billing
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground">
                {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : '—'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Start date
              </dt>
              <dd className="text-base font-semibold tabular-nums text-foreground">
                {subscription.startDate ? formatDate(subscription.startDate) : formatDate(subscription.createdAt)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Renewal
              </dt>
              <dd className="text-base font-semibold text-foreground">
                {isClosed
                  ? 'Inactive'
                  : subscription.autoRenew
                  ? `Renews automatically on ${subscription.endDate ? formatDate(subscription.endDate) : 'schedule'}`
                  : `Ends on ${subscription.endDate ? formatDate(subscription.endDate) : 'period end'}`}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground">Plan highlights</h3>
          <ul className="mt-4 space-y-3">
            {[
              'Enterprise-grade recurring billing support',
              'Automated tax calculations and transparent breakdown',
              '24/7 dedicated support and billing assistance',
              'Immediate access to AI Billing Copilot',
            ].map((benefit) => (
              <li key={benefit} className="flex gap-3 text-sm text-foreground-muted">
                <Check size={16} className="mt-0.5 shrink-0 text-success-text" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {detailOpen && (
        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          size="lg"
          title={`Subscription ${subscription.subscriptionNumber || subscription.id}`}
          description={`${customerName} · ${planName} plan`}
        >
          <div className="space-y-4 p-5 sm:p-6 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-foreground-muted">Status:</span>{' '}
                <span className="font-semibold text-foreground">{subscription.status}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Billing Cycle:</span>{' '}
                <span className="font-semibold text-foreground">{subscription.billingCycle}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Recurring Price:</span>{' '}
                <span className="font-semibold text-foreground">{formatINR(recurringAmount)}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Current Period Start:</span>{' '}
                <span className="font-semibold text-foreground">
                  {subscription.currentPeriodStart ? formatDate(subscription.currentPeriodStart) : '—'}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">Current Period End:</span>{' '}
                <span className="font-semibold text-foreground">
                  {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '—'}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
