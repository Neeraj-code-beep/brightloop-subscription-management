import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { SubscriptionsContext } from './SubscriptionsContext.js'
import { INITIAL_SUBSCRIPTIONS } from '../data/subscriptions.js'
import { getPlanById } from '../data/plans.js'
import useRole from '../hooks/useRole.js'
import { ROLES } from '../constants/roles.js'
import { REFERENCE_DATE, SUBSCRIPTION_NUMBER_PREFIX } from '../constants/subscriptions.js'
import { applyLifecycleAction } from '../services/subscriptionLifecycleService.js'
import subscriptionService from '../services/subscriptionService.js'

function nextSubscriptionId(subscriptions) {
  const highest = Math.max(
    0,
    ...subscriptions.map((subscription) => Number(subscription.id?.slice?.(SUBSCRIPTION_NUMBER_PREFIX.length) || 0)),
  )
  return `${SUBSCRIPTION_NUMBER_PREFIX}${highest + 1}`
}

function buildSubscription(input, { id, status, createdBy, activity }) {
  const plan = getPlanById(input.planId) || { productName: 'Standard', prices: { [input.billingFrequency]: 1000 } }

  return {
    id,
    customerId: input.customerId,
    planId: input.planId,
    billingFrequency: input.billingFrequency,
    paymentTerms: input.paymentTerms || 'NET_30',
    discountPercent: input.discountPercent || 0,
    status,
    paused: false,
    autoRenew: true,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    nextBillingDate: status === 'Draft' ? null : input.startDate,
    createdBy,
    lines: [
      {
        productName: plan.productName,
        quantity: input.quantity || 1,
        unitPrice: plan.prices?.[input.billingFrequency] || 1000,
      },
    ],
    activity,
  }
}

function withActivity(subscription, label) {
  return {
    ...subscription,
    activity: [
      { id: `${subscription.id}-${(subscription.activity || []).length + 1}`, date: REFERENCE_DATE, label },
      ...(subscription.activity || []),
    ],
  }
}

export default function SubscriptionsProvider({ children }) {
  const { user, role } = useRole()
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS)

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await subscriptionService.getSubscriptions({ limit: 100 })
      const list = Array.isArray(res) ? res : res?.subscriptions || []
      if (list.length > 0) {
        const mapped = list.map((s) => ({
          id: s.subscriptionNumber || s.id,
          backendId: s.id,
          customerId: s.customerId,
          customer: s.customer,
          planId: s.planId,
          plan: s.plan,
          planName: s.plan?.name || 'Standard',
          billingFrequency: s.billingCycle === 'MONTHLY' ? 'Monthly' : s.billingCycle === 'YEARLY' ? 'Yearly' : s.billingCycle,
          paymentTerms: s.paymentTerms || 'Net 30',
          discountPercent: Number(s.discountPercent || 0),
          status: s.status === 'ACTIVE' ? 'Active' : s.status === 'PAUSED' ? 'Active' : s.status === 'CANCELLED' ? 'Closed' : s.status,
          paused: s.status === 'PAUSED',
          autoRenew: Boolean(s.autoRenew),
          startDate: s.startDate || s.createdAt,
          expiryDate: s.endDate,
          nextBillingDate: s.nextBillingDate,
          recurringPrice: Number(s.recurringPrice || 0),
          createdBy: s.customer?.firstName || 'Staff',
          lines: [
            {
              productName: s.plan?.name || 'Subscription Plan',
              quantity: s.quantity || 1,
              unitPrice: Number(s.recurringPrice || 0),
            },
          ],
          activity: [
            { id: `${s.id}-1`, date: s.createdAt, label: `Subscription created for ${s.customer?.firstName || 'customer'}` },
          ],
        }))
        setSubscriptions(mapped)
      }
    } catch (err) {
      console.warn('Failed to load subscriptions from backend:', err)
    }
  }, [])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  const getSubscription = useCallback(
    (subscriptionId) => subscriptions.find((subscription) => subscription.id === subscriptionId || subscription.backendId === subscriptionId) ?? null,
    [subscriptions],
  )

  const replaceSubscription = useCallback((subscriptionId, update) => {
    setSubscriptions((previous) =>
      previous.map((subscription) => (subscription.id === subscriptionId || subscription.backendId === subscriptionId ? update(subscription) : subscription)),
    )
  }, [])

  const createSubscription = useCallback(
    async (input) => {
      const id = nextSubscriptionId(subscriptions)
      const subscription = buildSubscription(input, {
        id,
        status: 'Draft',
        createdBy: user.name,
        activity: [{ id: `${id}-1`, date: REFERENCE_DATE, label: `Subscription created by ${user.name}` }],
      })
      setSubscriptions((previous) => [subscription, ...previous])

      // Attempt backend persistence
      try {
        await subscriptionService.createSubscription({
          customerId: input.customerId,
          planId: input.planId,
          startDate: input.startDate || new Date().toISOString(),
          quantity: input.quantity || 1,
        })
      } catch (err) {
        console.warn('Backend subscription create error:', err)
      }

      return subscription
    },
    [subscriptions, user.name],
  )

  const duplicateSubscription = useCallback(
    (subscriptionId) => {
      const source = subscriptions.find((subscription) => subscription.id === subscriptionId)
      if (!source) return null
      const id = nextSubscriptionId(subscriptions)
      const subscription = buildSubscription(
        {
          customerId: source.customerId,
          planId: source.planId,
          quantity: source.lines?.[0]?.quantity || 1,
          billingFrequency: source.billingFrequency,
          paymentTerms: source.paymentTerms,
          discountPercent: source.discountPercent,
          startDate: source.startDate,
          expiryDate: source.expiryDate,
        },
        {
          id,
          status: 'Draft',
          createdBy: user.name,
          activity: [{ id: `${id}-1`, date: REFERENCE_DATE, label: `Duplicated from ${source.id}` }],
        },
      )
      setSubscriptions((previous) => [subscription, ...previous])
      return subscription
    },
    [subscriptions, user.name],
  )

  const updateSubscription = useCallback(
    (subscriptionId, input) => {
      replaceSubscription(subscriptionId, (subscription) => {
        const plan = getPlanById(subscription.planId) || { prices: {} }
        return withActivity(
          {
            ...subscription,
            billingFrequency: input.billingFrequency,
            paymentTerms: input.paymentTerms,
            discountPercent: input.discountPercent,
            startDate: input.startDate,
            expiryDate: input.expiryDate,
            lines: (subscription.lines || []).map((line) => ({
              ...line,
              quantity: input.quantity,
              unitPrice: plan.prices?.[input.billingFrequency] || line.unitPrice,
            })),
          },
          'Subscription details updated',
        )
      })
    },
    [replaceSubscription],
  )

  const runLifecycleAction = useCallback(
    async (subscriptionId, action, options = {}) => {
      if (role === ROLES.CUSTOMER) {
        throw new Error('Customers cannot change subscription lifecycle.')
      }

      const current = subscriptions.find((s) => s.id === subscriptionId || s.backendId === subscriptionId)
      if (!current) return { error: 'Subscription not found.' }

      const targetId = current.backendId || current.id

      // Execute on Backend API
      try {
        if (action === 'pause') {
          await subscriptionService.pauseSubscription(targetId, options.reason || 'Requested pause')
        } else if (action === 'resume') {
          await subscriptionService.resumeSubscription(targetId)
        } else if (action === 'cancel' || action === 'close') {
          await subscriptionService.cancelSubscription(targetId, options.reason || 'Requested cancel', options.cancelImmediately)
        }
      } catch (err) {
        console.warn(`Backend lifecycle action ${action} warning:`, err?.message)
      }

      const result = applyLifecycleAction(current, action, { subscriptions, ...options })
      if (result.error) return result

      setSubscriptions((previous) =>
        previous.map((subscription) => (subscription.id === subscriptionId || subscription.backendId === subscriptionId ? result.subscription : subscription)),
      )
      return result
    },
    [subscriptions, role],
  )

  const addSubscriptionActivity = useCallback(
    (subscriptionId, label) => {
      replaceSubscription(subscriptionId, (subscription) => withActivity(subscription, label))
    },
    [replaceSubscription],
  )

  const value = useMemo(
    () => ({
      subscriptions,
      getSubscription,
      createSubscription,
      duplicateSubscription,
      updateSubscription,
      runLifecycleAction,
      addSubscriptionActivity,
      refreshSubscriptions: loadSubscriptions,
    }),
    [
      subscriptions,
      getSubscription,
      createSubscription,
      duplicateSubscription,
      updateSubscription,
      runLifecycleAction,
      addSubscriptionActivity,
      loadSubscriptions,
    ],
  )

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>
}
