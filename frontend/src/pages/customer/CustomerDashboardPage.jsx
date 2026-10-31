import React, { useEffect, useState, useMemo, useCallback } from 'react'
import PageHeader from '../../components/shared/PageHeader.jsx'
import KpiCard from '../../components/dashboard/KpiCard.jsx'
import RecentInvoicesTable from '../../components/dashboard/RecentInvoicesTable.jsx'
import RecentPaymentsList from '../../components/dashboard/RecentPaymentsList.jsx'
import useAuth from '../../hooks/useAuth.js'
import customerService from '../../services/customerService.js'
import { formatDate, formatINR } from '../../utils/format.js'

export default function CustomerDashboardPage() {
  const { user, customerId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [billingSummary, setBillingSummary] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])

  const loadData = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [sumRes, subRes, invRes, payRes] = await Promise.allSettled([
        customerService.getBillingSummary(customerId),
        customerService.getSubscriptions(customerId),
        customerService.getInvoices(customerId),
        customerService.getPayments(customerId),
      ])

      if (sumRes.status === 'fulfilled') setBillingSummary(sumRes.value)
      if (subRes.status === 'fulfilled') {
        const list = Array.isArray(subRes.value) ? subRes.value : subRes.value.subscriptions || []
        setSubscriptions(list)
      }
      if (invRes.status === 'fulfilled') {
        const list = Array.isArray(invRes.value) ? invRes.value : invRes.value.invoices || []
        setInvoices(list)
      }
      if (payRes.status === 'fulfilled') {
        const list = Array.isArray(payRes.value) ? payRes.value : payRes.value.payments || []
        setPayments(list)
      }
    } catch (err) {
      console.warn('Failed to load customer dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeSubscription = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0]
  const planName = activeSubscription?.plan?.name || (activeSubscription ? 'Standard Plan' : 'No active plan')

  const formattedInvoices = invoices.map((inv) => ({
    id: inv.invoiceNumber || inv.id,
    customer: user?.name || 'My Account',
    amount: Number(inv.totalAmount || 0),
    dueDate: inv.dueDate,
    status: inv.status,
  }))

  const openInvoices = formattedInvoices.filter((inv) => inv.status !== 'PAID')
  const nextInvoice = openInvoices[0]
  const outstandingAmount = Number(billingSummary?.invoices?.totalOutstandingBalance || 0)
  const totalPaid = Number(billingSummary?.payments?.totalPaidAmount || 0)

  const paymentItems = payments.map((p) => ({
    id: p.paymentNumber || p.id,
    customer: user?.name || 'My Account',
    amount: Number(p.amount || 0),
    method: p.paymentMethod || 'Card',
    date: p.paymentDate || p.createdAt,
    status: p.status === 'SUCCEEDED' ? 'Captured' : p.status,
  }))

  const kpis = useMemo(
    () => [
      {
        id: 'current-plan',
        label: 'Current Plan',
        value: planName,
        helper: activeSubscription ? activeSubscription.status : 'No subscription',
        tone: 'primary',
        trend: 'neutral',
      },
      {
        id: 'next-payment',
        label: 'Next Payment Due',
        value: nextInvoice ? formatINR(nextInvoice.amount) : '₹0.00',
        helper: nextInvoice?.dueDate ? `Due ${formatDate(nextInvoice.dueDate)}` : 'All caught up',
        tone: 'primary',
        trend: 'neutral',
      },
      {
        id: 'outstanding',
        label: 'Outstanding Balance',
        value: formatINR(outstandingAmount),
        helper: `${openInvoices.length} unpaid invoice${openInvoices.length === 1 ? '' : 's'}`,
        tone: 'warning',
        trend: 'neutral',
      },
      {
        id: 'total-paid',
        label: 'Total Paid to Date',
        value: formatINR(totalPaid),
        helper: `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded`,
        tone: 'success',
        trend: 'up',
      },
    ],
    [planName, activeSubscription, nextInvoice, outstandingAmount, openInvoices.length, totalPaid, payments.length]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Welcome to SubPilot" description="Loading your billing overview..." />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface-muted" />
          ))}
        </div>
      </div>
    )
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'there'

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your plan, invoices, and payments in one place"
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentInvoicesTable
            title="My Invoices"
            description="Invoices issued to your account"
            invoices={formattedInvoices.slice(0, 5)}
            viewAllTo="/customer/invoices"
          />
        </div>
        <RecentPaymentsList
          title="My Payments"
          description="Receipts from your account"
          payments={paymentItems.slice(0, 5)}
          viewAllTo="/customer/payments"
        />
      </section>
    </div>
  )
}
