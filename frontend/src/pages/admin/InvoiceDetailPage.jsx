import { ArrowLeft, ChevronDown, Printer, Send, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InvoiceDocument from '../../components/invoices/InvoiceDocument.jsx'
import InvoicePaymentForm from '../../components/invoices/InvoicePaymentForm.jsx'
import InvoicePaymentHistory from '../../components/invoices/InvoicePaymentHistory.jsx'
import SendInvoiceForm from '../../components/invoices/SendInvoiceForm.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { ROLES } from '../../constants/roles.js'
import { getCustomerById } from '../../data/customers.js'
import useInvoices from '../../hooks/useInvoices.js'
import useRole from '../../hooks/useRole.js'
import useToast from '../../hooks/useToast.js'
import { getCustomerEmail } from '../../utils/customerContact.js'
import { formatDate } from '../../utils/format.js'
import { getInvoiceTotals, isPaymentPendingCollection, resolveInvoiceStatus } from '../../utils/invoiceMath.js'
import { getPaymentsForInvoice, paidAmountFor } from '../../utils/paymentQueries.js'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const { role, user } = useRole()
  const { getInvoice, payments, confirmInvoice, recordPayment, sendInvoice } = useInvoices()
  const { showToast } = useToast()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const isCustomer = role === ROLES.CUSTOMER
  const listPath = isCustomer ? '/customer/invoices' : '/invoices'
  const invoice = getInvoice(id)

  if (!invoice || (isCustomer && invoice.customerId !== user.customerId)) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Invoice not found"
          description="This invoice may not exist, or it is not available to your account."
          action={
            <Link to={listPath} className={buttonVariants({ variant: 'secondary' })}>
              Back to invoices
            </Link>
          }
        />
      </Card>
    )
  }

  const status = resolveInvoiceStatus(invoice)
  const customer = getCustomerById(invoice.customerId)
  const customerName = customer?.name ?? 'Unknown customer'
  const invoicePayments = getPaymentsForInvoice(payments, invoice.number)
  const total = getInvoiceTotals(invoice).total
  const amountDue = total - paidAmountFor(payments, invoice.number)
  const canConfirm = !isCustomer && status === 'Draft'
  const canRecordPayment = !isCustomer && isPaymentPendingCollection(invoice)
  const recipientEmail = getCustomerEmail(invoice.customerId)

  function handleConfirm() {
    confirmInvoice(invoice.number)
    showToast({ title: `Invoice ${invoice.number} confirmed.` })
  }

  function handleRecordPayment(input) {
    const payment = recordPayment(invoice.number, input)
    if (!payment) {
      showToast({ title: 'This payment could not be recorded.' })
      return
    }
    setPaymentOpen(false)
    const paidInFull = input.amount >= amountDue
    showToast({
      title: paidInFull
        ? `Invoice ${invoice.number} paid in full.`
        : `Payment ${payment.id} recorded for ${invoice.number}.`,
    })
  }

  function handleSendInvoice({ recipientEmail: to, message }) {
    sendInvoice(invoice.number, { recipientEmail: to, message })
    setSendOpen(false)
    showToast({ title: `Invoice ${invoice.number} sent to ${to}` })
  }

  return (
    <div className="space-y-6">
      <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to invoices
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {invoice.number}
            </h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm font-medium text-foreground">{customerName}</p>
          <p className="text-sm tabular-nums text-foreground-muted">
            Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
          </p>
          {invoice.sent && (
            <p className="flex items-center gap-1.5 text-sm text-foreground-muted">
              <Send size={14} aria-hidden="true" className="shrink-0" />
              <span>
                Sent to {invoice.sent.to} on {formatDate(invoice.sent.on)} (demo, no email delivered)
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {canConfirm && (
            <button type="button" onClick={handleConfirm} className={buttonVariants({ variant: 'primary' })}>
              Confirm invoice
            </button>
          )}
          {canRecordPayment && (
            <button type="button" onClick={() => setPaymentOpen(true)} className={buttonVariants({ variant: 'primary' })}>
              Record payment
            </button>
          )}
          {!isCustomer && (
            <button type="button" onClick={() => setSendOpen(true)} className={buttonVariants({ variant: 'secondary' })}>
              <Send size={16} aria-hidden="true" />
              Send invoice
            </button>
          )}
          <button type="button" onClick={() => window.print()} className={buttonVariants({ variant: 'secondary' })}>
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          {!isCustomer && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={buttonVariants({ variant: 'secondary' })}
              >
                More
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
                >
                  <Link
                    to={`/subscriptions/${invoice.subscriptionId}`}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    View subscription
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <InvoiceDocument
        invoice={invoice}
        customer={customer}
        status={status}
        showSubscriptionLink={!isCustomer}
        payments={invoicePayments}
      />

      <InvoicePaymentHistory payments={invoicePayments} />

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send invoice"
        description={`Simulated send for ${invoice.number}`}
      >
        <SendInvoiceForm
          invoiceNumber={invoice.number}
          customerName={customerName}
          total={total}
          recipientEmail={recipientEmail}
          onSubmit={handleSendInvoice}
          onCancel={() => setSendOpen(false)}
        />
      </Modal>

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Record payment"
        description={`Payment against ${invoice.number}`}
      >
        <InvoicePaymentForm
          invoiceNumber={invoice.number}
          customerName={customerName}
          amountOutstanding={amountDue}
          onSubmit={handleRecordPayment}
          onCancel={() => setPaymentOpen(false)}
        />
      </Modal>
    </div>
  )
}
