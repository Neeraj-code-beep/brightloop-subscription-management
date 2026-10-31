import { CreditCard, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import PaymentFilters from '../../components/payments/PaymentFilters.jsx'
import PaymentTable from '../../components/payments/PaymentTable.jsx'
import Card from '../../components/ui/Card.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import useInvoices from '../../hooks/useInvoices.js'
import { formatINR } from '../../utils/format.js'
import { summarizeInvoices } from '../../utils/invoiceQueries.js'
import { EMPTY_PAYMENT_FILTERS, filterPayments, summarizePayments, toPaymentRow } from '../../utils/paymentQueries.js'

export default function PaymentsPage() {
  const { invoices, payments } = useInvoices()
  const [filters, setFilters] = useState(EMPTY_PAYMENT_FILTERS)

  const collected = useMemo(() => summarizePayments(payments), [payments])
  const invoiceSummary = useMemo(() => summarizeInvoices(invoices, payments), [invoices, payments])

  const stats = [
    { label: 'Total collected', value: formatINR(collected.amount), helper: 'All recorded payments' },
    { label: 'Payments', value: String(collected.count), helper: 'Recorded in total' },
    {
      label: 'Outstanding',
      value: formatINR(invoiceSummary.outstanding.amount),
      helper: `${invoiceSummary.outstanding.count} unpaid invoices`,
    },
  ]

  const rows = filterPayments(payments, filters).map(toPaymentRow)

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Track collections and every payment recorded against invoices" />

      <StatStrip stats={stats} ariaLabel="Payment summary" />

      <div className="space-y-4">
        <PaymentFilters filters={filters} onChange={updateFilter} onClear={() => setFilters(EMPTY_PAYMENT_FILTERS)} />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {payments.length} payments
        </p>

        {rows.length > 0 ? (
          <PaymentTable rows={rows} />
        ) : (
          <Card>
            {payments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments yet"
                description="Record a payment from an invoice and it will appear here."
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No payments match these filters"
                description="Try a different search term or clear the filters to see every payment."
                action={
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_PAYMENT_FILTERS)}
                    className={buttonVariants({ variant: 'secondary' })}
                  >
                    Clear filters
                  </button>
                }
              />
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
