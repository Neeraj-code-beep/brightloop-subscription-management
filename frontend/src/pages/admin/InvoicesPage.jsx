import { FileText, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import CreateInvoiceForm from '../../components/invoices/CreateInvoiceForm.jsx'
import InvoiceFilters from '../../components/invoices/InvoiceFilters.jsx'
import InvoiceTable from '../../components/invoices/InvoiceTable.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { getCustomerById } from '../../data/customers.js'
import useInvoices from '../../hooks/useInvoices.js'
import useSubscriptions from '../../hooks/useSubscriptions.js'
import useToast from '../../hooks/useToast.js'
import { formatINR } from '../../utils/format.js'
import {
  EMPTY_INVOICE_FILTERS,
  filterInvoices,
  getBillableSubscriptions,
  summarizeInvoices,
  toInvoiceRow,
} from '../../utils/invoiceQueries.js'

function getCustomerName(customerId) {
  return getCustomerById(customerId)?.name ?? 'Unknown customer'
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const { invoices, payments, createInvoiceFromSubscription } = useInvoices()
  const { subscriptions } = useSubscriptions()
  const { showToast } = useToast()
  const [filters, setFilters] = useState(EMPTY_INVOICE_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)

  const summary = useMemo(() => summarizeInvoices(invoices, payments), [invoices, payments])
  const billableSubscriptions = useMemo(() => getBillableSubscriptions(subscriptions), [subscriptions])

  const stats = [
    { label: 'Total invoices', value: String(summary.total) },
    {
      label: 'Outstanding',
      value: formatINR(summary.outstanding.amount),
      helper: `${summary.outstanding.count} unpaid`,
    },
    { label: 'Overdue', value: formatINR(summary.overdue.amount), helper: `${summary.overdue.count} past due` },
    {
      label: 'Paid this month',
      value: formatINR(summary.paidThisMonth.amount),
      helper: `${summary.paidThisMonth.count} received`,
    },
  ]

  const rows = filterInvoices(invoices, filters, getCustomerName).map(toInvoiceRow)

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  function handleCreate(subscription) {
    const invoice = createInvoiceFromSubscription(subscription)
    setCreateOpen(false)
    showToast({ title: `Invoice ${invoice.number} created successfully.` })
    navigate(`/invoices/${invoice.number}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage billing, collections, and invoice status"
        action={
          <button type="button" onClick={() => setCreateOpen(true)} className={buttonVariants({ variant: 'primary' })}>
            <Plus size={16} aria-hidden="true" />
            Create invoice
          </button>
        }
      />

      <StatStrip stats={stats} ariaLabel="Invoice summary" />

      <div className="space-y-4">
        <InvoiceFilters filters={filters} onChange={updateFilter} onClear={() => setFilters(EMPTY_INVOICE_FILTERS)} />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {invoices.length} invoices
        </p>

        {rows.length > 0 ? (
          <InvoiceTable rows={rows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No invoices match these filters"
              description="Try a different search term or clear the filters to see every invoice."
              action={
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_INVOICE_FILTERS)}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  Clear filters
                </button>
              }
            />
          </Card>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create invoice"
        description="Bill an active or confirmed subscription. The invoice starts as a draft."
      >
        {billableSubscriptions.length > 0 ? (
          <CreateInvoiceForm
            subscriptions={billableSubscriptions}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        ) : (
          <div className="px-5 py-8 sm:px-6">
            <EmptyState
              icon={FileText}
              title="No subscriptions to bill"
              description="Create or confirm a subscription first, then it can be invoiced here."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
