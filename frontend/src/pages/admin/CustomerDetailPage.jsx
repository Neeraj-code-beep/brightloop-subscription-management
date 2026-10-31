import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { ArrowLeft, CreditCard, FileText, Repeat, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import InvoiceTable from '../../components/invoices/InvoiceTable.jsx'
import PaymentTable from '../../components/payments/PaymentTable.jsx'
import Card from '../../components/ui/Card.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import CustomerCreditSection from '../../components/customers/CustomerCreditSection.jsx'
import customerService from '../../services/customerService.js'
import { formatDate, formatINR } from '../../utils/format.js'

function DetailField({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-foreground-subtle">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children}
    </Card>
  )
}

function SubscriptionSummary({ subscription }) {
  if (!subscription) {
    return (
      <EmptyState
        icon={Repeat}
        title="No subscription yet"
        description="This customer does not have a subscription. One can be created from the subscriptions page."
      />
    )
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
      <DetailField
        label="Subscription"
        value={
          <Link to={`/subscriptions/${subscription.id}`} className="text-primary hover:underline">
            {subscription.subscriptionNumber || subscription.id}
          </Link>
        }
      />
      <DetailField label="Status" value={<StatusBadge status={subscription.status} />} />
      <DetailField label="Plan" value={subscription.plan?.name || subscription.planName || 'Standard'} />
      <DetailField label="Billing" value={subscription.billingCycle || subscription.billingFrequency || 'Monthly'} />
      <DetailField
        label="Amount"
        value={<span className="tabular-nums">{formatINR(Number(subscription.recurringPrice || subscription.amount || 0))}</span>}
      />
      <DetailField
        label="Next billing"
        value={
          <span className="tabular-nums">
            {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : '—'}
          </span>
        }
      />
    </dl>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [billingSummary, setBillingSummary] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [custRes, summaryRes, subRes, invRes, payRes] = await Promise.allSettled([
        customerService.getCustomerById(id),
        customerService.getBillingSummary(id),
        customerService.getSubscriptions(id),
        customerService.getInvoices(id),
        customerService.getPayments(id),
      ])

      if (custRes.status === 'fulfilled') setCustomer(custRes.value)
      if (summaryRes.status === 'fulfilled') setBillingSummary(summaryRes.value)
      if (subRes.status === 'fulfilled') {
        const subs = Array.isArray(subRes.value) ? subRes.value : subRes.value.subscriptions || []
        setSubscriptions(subs)
      }
      if (invRes.status === 'fulfilled') {
        const invs = Array.isArray(invRes.value) ? invRes.value : invRes.value.invoices || []
        setInvoices(invs)
      }
      if (payRes.status === 'fulfilled') {
        const pays = Array.isArray(payRes.value) ? payRes.value : payRes.value.payments || []
        setPayments(pays)
      }
    } catch (err) {
      console.error('Failed to load customer detail:', err)
      setError(err?.message || 'Failed to load customer details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse bg-surface-muted" />
        <div className="h-12 w-64 animate-pulse bg-surface-muted" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      </div>
    )
  }

  if (!customer && !loading) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Customer not found"
          description="This customer may have been removed, or the link is incorrect."
          action={
            <Link to="/customers" className={buttonVariants({ variant: 'secondary' })}>
              Back to customers
            </Link>
          }
        />
      </Card>
    )
  }

  const customerName =
    customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
  const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0]

  // Note: getCustomerBillingSummary returns top-level subscriptions, invoices, payments objects
  const totalInvoiced = Number(billingSummary?.invoices?.totalInvoicedAmount || 0)
  const totalPaid = Number(billingSummary?.payments?.totalPaidAmount || 0)
  const totalOutstanding = Number(billingSummary?.invoices?.totalOutstandingBalance || 0)
  const openInvoicesCount = billingSummary?.invoices?.unpaidCount ?? invoices.filter((i) => i.status !== 'PAID').length

  const billingStats = [
    { label: 'Total billed', value: formatINR(totalInvoiced) },
    { label: 'Total paid', value: formatINR(totalPaid) },
    { label: 'Outstanding', value: formatINR(totalOutstanding) },
    { label: 'Open invoices', value: String(openInvoicesCount) },
  ]

  const formattedInvoices = invoices.map((inv) => ({
    id: inv.invoiceNumber || inv.id,
    number: inv.invoiceNumber || inv.id,
    amount: Number(inv.totalAmount || 0),
    issueDate: inv.issueDate || inv.createdAt,
    dueDate: inv.dueDate,
    status: inv.status,
    customerName,
  }))

  const formattedPayments = payments.map((p) => ({
    id: p.paymentNumber || p.id,
    invoiceNumber: p.invoice?.invoiceNumber || p.invoiceId || '—',
    amount: Number(p.amount || 0),
    date: p.paymentDate || p.createdAt,
    method: p.paymentMethod || 'Manual',
    status: p.status,
  }))

  return (
    <div className="space-y-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-150 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to customers
      </Link>

      <PageHeader
        title={customerName}
        description={`${customer.customerCode || customer.id} · ${customer.city || customer.billingCity || '—'}`}
        action={<StatusBadge status={activeSub?.status ?? (customer.isActive ? 'Active' : 'Inactive')} />}
      />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Overview">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <DetailField label="Contact Person" value={`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—'} />
            <DetailField label="Email" value={customer.email ?? '—'} />
            <DetailField label="Phone" value={customer.phone ?? '—'} />
            <DetailField label="Customer Type" value={customer.customerType || 'INDIVIDUAL'} />
            <DetailField label="Customer since" value={customer.createdAt ? formatDate(customer.createdAt) : '—'} />
          </dl>
        </SectionCard>

        <SectionCard title="Current Subscription">
          <SubscriptionSummary subscription={activeSub} />
        </SectionCard>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Billing Overview</h3>
        <StatStrip stats={billingStats} ariaLabel="Customer billing stats" />
      </div>

      <CustomerCreditSection customerId={customer.id} isAdmin={true} />

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Invoices ({formattedInvoices.length})</h3>
        {formattedInvoices.length > 0 ? (
          <InvoiceTable invoices={formattedInvoices} />
        ) : (
          <Card>
            <EmptyState icon={FileText} title="No invoices" description="No invoices found for this customer." />
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Payments ({formattedPayments.length})</h3>
        {formattedPayments.length > 0 ? (
          <PaymentTable payments={formattedPayments} />
        ) : (
          <Card>
            <EmptyState icon={CreditCard} title="No payments" description="No payments found for this customer." />
          </Card>
        )}
      </div>
    </div>
  )
}
