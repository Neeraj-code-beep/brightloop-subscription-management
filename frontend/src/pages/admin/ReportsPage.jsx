import { useCallback, useMemo, useState } from 'react'
import ReportFilters from '../../components/reports/ReportFilters.jsx'
import RevenueChart from '../../components/reports/RevenueChart.jsx'
import {
  OpenInvoicesTable,
  RecentPaymentsTable,
  RevenueByProductTable,
} from '../../components/reports/ReportTables.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import { ROLES } from '../../constants/roles.js'
import useInvoices from '../../hooks/useInvoices.js'
import useRole from '../../hooks/useRole.js'
import useSubscriptions from '../../hooks/useSubscriptions.js'
import { formatINR } from '../../utils/format.js'
import {
  EMPTY_REPORT_FILTERS,
  getMethodOptions,
  getMonthlyRevenue,
  getOpenInvoiceRows,
  getProductOptions,
  getRecentPaymentRows,
  getReportSummary,
  getRevenueByProduct,
} from '../../utils/reportQueries.js'

const RECENT_PAYMENTS_LIMIT = 10

function formatCount(value) {
  return value.toLocaleString('en-IN')
}

export default function ReportsPage() {
  const { role } = useRole()
  const { subscriptions } = useSubscriptions()
  const { invoices, payments } = useInvoices()
  const [filters, setFilters] = useState(EMPTY_REPORT_FILTERS)
  const isAdmin = role === ROLES.ADMIN

  const handleFilterChange = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }, [])

  const handleClear = useCallback(() => setFilters(EMPTY_REPORT_FILTERS), [])

  const productOptions = useMemo(() => getProductOptions(invoices), [invoices])
  const methodOptions = useMemo(() => getMethodOptions(payments), [payments])

  const summary = useMemo(
    () => getReportSummary({ subscriptions, invoices, payments }, filters),
    [subscriptions, invoices, payments, filters],
  )

  const statStrip = useMemo(() => {
    const operational = [
      { label: 'Payments collected', value: formatINR(summary.collected) },
      { label: 'Outstanding', value: formatINR(summary.outstanding) },
      { label: 'Overdue invoices', value: formatCount(summary.overdueCount) },
      { label: 'Paid invoices', value: formatCount(summary.paidCount) },
    ]
    if (!isAdmin) return operational

    return [
      { label: 'Active subscriptions', value: formatCount(summary.active) },
      { label: 'Monthly recurring revenue', value: formatINR(summary.monthlyRecurringRevenue) },
      { label: 'Billed in period', value: formatINR(summary.revenue) },
      ...operational,
      { label: 'Active customers', value: formatCount(summary.activeCustomers) },
    ]
  }, [summary, isAdmin])

  const monthlyRevenue = useMemo(
    () => getMonthlyRevenue(invoices, payments, filters),
    [invoices, payments, filters],
  )

  const revenueByProduct = useMemo(
    () => (isAdmin ? getRevenueByProduct(invoices, filters) : []),
    [invoices, filters, isAdmin],
  )

  const openRows = useMemo(
    () => getOpenInvoiceRows(invoices, payments, filters),
    [invoices, payments, filters],
  )

  const recentPaymentRows = useMemo(
    () => getRecentPaymentRows(payments, invoices, filters, RECENT_PAYMENTS_LIMIT),
    [payments, invoices, filters],
  )

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Reports"
        description={
          isAdmin
            ? 'Revenue, collections, and receivables. Figures update with the filters below.'
            : 'Collections and receivables. Figures update with the filters below.'
        }
      />

      <ReportFilters
        filters={filters}
        productOptions={productOptions}
        methodOptions={methodOptions}
        onChange={handleFilterChange}
        onClear={handleClear}
        isAdmin={isAdmin}
      />

      <StatStrip stats={statStrip} ariaLabel="Report summary" gridClassName="md:grid-cols-4" />

      <RevenueChart data={monthlyRevenue} showBilled={isAdmin} />

      {isAdmin && <RevenueByProductTable rows={revenueByProduct} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <OpenInvoicesTable rows={openRows} />
        <RecentPaymentsTable rows={recentPaymentRows} />
      </div>
    </div>
  )
}
