import React, { useEffect, useState, useMemo, useCallback } from 'react'
import KpiCard from '../../components/dashboard/KpiCard.jsx'
import RecentInvoicesTable from '../../components/dashboard/RecentInvoicesTable.jsx'
import RecentPaymentsList from '../../components/dashboard/RecentPaymentsList.jsx'
import RevenueTrendChart from '../../components/dashboard/RevenueTrendChart.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import analyticsService from '../../services/analyticsService.js'
import invoiceApi from '../../services/invoiceService.js'
import paymentApi from '../../services/paymentService.js'
import { formatINR } from '../../utils/format.js'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentPayments, setRecentPayments] = useState([])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, sum, rev, invRes, payRes] = await Promise.allSettled([
        analyticsService.getDashboard(),
        analyticsService.getSummary(),
        analyticsService.getRevenue('month'),
        invoiceApi.getInvoices({ limit: 5, page: 1 }),
        paymentApi.getPayments({ limit: 5, page: 1 }),
      ])

      if (dash.status === 'fulfilled') setDashboardData(dash.value)
      if (sum.status === 'fulfilled') setSummaryData(sum.value)

      if (rev.status === 'fulfilled' && rev.value?.revenueByPeriod) {
        const trend = rev.value.revenueByPeriod.map((p) => ({
          month: p.period,
          value: Math.round(Number(p.invoiced || 0) / 1000) / 100,
        }))
        setRevenueData(trend.length > 0 ? trend : [{ month: 'Current', value: 0 }])
      }

      if (invRes.status === 'fulfilled' && invRes.value) {
        const list = Array.isArray(invRes.value) ? invRes.value : invRes.value.invoices || invRes.value.data || []
        setRecentInvoices(
          list.slice(0, 5).map((inv) => ({
            id: inv.invoiceNumber || inv.id,
            customer: inv.customer?.companyName || `${inv.customer?.firstName || ''} ${inv.customer?.lastName || ''}`.trim() || 'Customer',
            amount: Number(inv.totalAmount || 0),
            dueDate: inv.dueDate,
            status: inv.status,
          }))
        )
      }

      if (payRes.status === 'fulfilled' && payRes.value) {
        const list = Array.isArray(payRes.value) ? payRes.value : payRes.value.payments || payRes.value.data || []
        setRecentPayments(
          list.slice(0, 5).map((p) => ({
            id: p.paymentNumber || p.id,
            customer: p.customer?.companyName || `${p.customer?.firstName || ''} ${p.customer?.lastName || ''}`.trim() || 'Customer',
            amount: Number(p.amount || 0),
            method: p.paymentMethod || 'Manual',
            date: p.paymentDate || p.createdAt,
            status: p.status === 'SUCCEEDED' ? 'Captured' : p.status,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError(err?.message || 'Failed to load dashboard metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const kpis = useMemo(() => {
    const activeSubs = summaryData?.activeSubscriptions ?? dashboardData?.activeSubscriptions ?? 0
    const mrrVal = dashboardData?.mrr ?? '0.00'
    const outstandingVal = dashboardData?.totalOutstanding ?? summaryData?.totalOutstandingAmount ?? '0.00'
    const overdueCount = summaryData?.overdueInvoices ?? 0

    return [
      {
        id: 'active-subscriptions',
        label: 'Active Subscriptions',
        value: Number(activeSubs).toLocaleString('en-IN'),
        helper: `${summaryData?.pendingSubscriptions ?? 0} pending, ${summaryData?.cancelledSubscriptions ?? 0} cancelled`,
        tone: 'primary',
        trend: 'neutral',
      },
      {
        id: 'mrr',
        label: 'Monthly Recurring Revenue',
        value: formatINR(Number(mrrVal)),
        helper: `ARR: ${formatINR(Number(dashboardData?.arr || 0))}`,
        tone: 'success',
        trend: 'neutral',
      },
      {
        id: 'outstanding',
        label: 'Outstanding Balance',
        value: formatINR(Number(outstandingVal)),
        helper: `Invoiced: ${formatINR(Number(dashboardData?.totalInvoiced || 0))}`,
        tone: 'warning',
        trend: 'neutral',
      },
      {
        id: 'overdue-invoices',
        label: 'Overdue Invoices',
        value: Number(overdueCount).toLocaleString('en-IN'),
        helper: `Collection rate: ${dashboardData?.collectionRate || '0.00'}%`,
        tone: 'error',
        trend: 'neutral',
      },
    ]
  }, [dashboardData, summaryData])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing Overview" description="Loading real-time financial metrics..." />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Billing Overview"
          description="Live subscriptions, receivables, and collections from SubPilot backend"
        />
        <button
          onClick={loadDashboard}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {revenueData.length > 0 ? (
            <RevenueTrendChart data={revenueData} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface text-sm text-foreground-muted">
              No revenue data recorded yet.
            </div>
          )}
        </div>
        <RecentPaymentsList
          title="Recent Payments"
          description="Latest receipts"
          payments={recentPayments}
          viewAllTo="/payments"
        />
      </section>

      <RecentInvoicesTable
        title="Recent Invoices"
        description="Latest billing activity across all customers"
        invoices={recentInvoices}
        viewAllTo="/invoices"
      />
    </div>
  )
}
