import { ArrowLeft, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../../components/shared/EmptyState.jsx'
import SubscriptionDetail from '../../components/subscriptions/SubscriptionDetail.jsx'
import SubscriptionForm from '../../components/subscriptions/SubscriptionForm.jsx'
import SubscriptionLifecycle from '../../components/subscriptions/SubscriptionLifecycle.jsx'
import SubscriptionLifecycleActions from '../../components/subscriptions/SubscriptionLifecycleActions.jsx'
import SubscriptionQuotation from '../../components/subscriptions/SubscriptionQuotation.jsx'
import SubscriptionRenewForm from '../../components/subscriptions/SubscriptionRenewForm.jsx'
import SubscriptionStatusBadge from '../../components/subscriptions/SubscriptionStatusBadge.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { getCustomerById } from '../../data/customers.js'
import { getPlanById } from '../../data/plans.js'
import useInvoices from '../../hooks/useInvoices.js'
import useSubscriptions from '../../hooks/useSubscriptions.js'
import useToast from '../../hooks/useToast.js'
import {
  LIFECYCLE_ACTIONS,
  canGenerateInvoice,
  getAvailableActions,
} from '../../services/subscriptionLifecycleService.js'

function getCustomerName(customerId) {
  return getCustomerById(customerId)?.name ?? 'Unknown customer'
}

function getPlanName(planId) {
  return getPlanById(planId)?.name ?? '—'
}

export default function SubscriptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getSubscription, updateSubscription, runLifecycleAction, duplicateSubscription } = useSubscriptions()
  const { createInvoiceFromSubscription } = useInvoices()
  const { showToast } = useToast()
  const subscription = getSubscription(id)
  const [editOpen, setEditOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [quotationOpen, setQuotationOpen] = useState(false)

  if (!subscription) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Subscription not found"
          description="This subscription may have been removed, or the link is incorrect."
          action={
            <Link to="/subscriptions" className={buttonVariants({ variant: 'secondary' })}>
              Back to subscriptions
            </Link>
          }
        />
      </Card>
    )
  }

  const customer = getCustomerById(subscription.customerId)
  const customerName = getCustomerName(subscription.customerId)
  const planName = getPlanName(subscription.planId)
  const availableActions = getAvailableActions(subscription)

  function runLifecycle(action, options) {
    const result = runLifecycleAction(subscription.id, action, options)
    if (result.error) {
      showToast({ title: 'Action not available', description: result.error })
      return false
    }
    showToast({ title: result.subscription.activity[0].label })
    return true
  }

  function handleLifecycleAction(action) {
    if (action === LIFECYCLE_ACTIONS.RENEW) {
      setRenewOpen(true)
      return
    }
    runLifecycle(action)
  }

  function handleRenew(expiryDate) {
    if (runLifecycle(LIFECYCLE_ACTIONS.RENEW, { expiryDate })) setRenewOpen(false)
  }

  function handleClose() {
    runLifecycle(LIFECYCLE_ACTIONS.CLOSE)
    setCloseOpen(false)
  }

  function handleGenerateInvoice() {
    if (!canGenerateInvoice(subscription)) return
    const invoice = createInvoiceFromSubscription(subscription)
    showToast({ title: `Invoice ${invoice.number} created successfully.` })
    navigate(`/invoices/${invoice.number}`)
  }

  function handleEdit(input) {
    updateSubscription(subscription.id, input)
    setEditOpen(false)
    showToast({ title: `Subscription ${subscription.id} updated.` })
  }

  function handleDuplicate() {
    const draft = duplicateSubscription(subscription.id)
    showToast({ title: `Draft ${draft.id} created from ${subscription.id}.` })
    navigate(`/subscriptions/${draft.id}`)
  }

  return (
    <div className="space-y-6">
      <Link
        to="/subscriptions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to subscriptions
      </Link>

      <div className="space-y-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {subscription.id}
            </h2>
            <SubscriptionStatusBadge status={subscription.status} paused={subscription.paused} />
          </div>
          <p className="text-sm text-foreground-muted">{customerName}</p>
        </div>

        <SubscriptionLifecycleActions
          subscription={subscription}
          availableActions={availableActions}
          onLifecycleAction={handleLifecycleAction}
          onClose={() => setCloseOpen(true)}
          onEdit={() => setEditOpen(true)}
          onGenerateInvoice={handleGenerateInvoice}
          onDuplicate={handleDuplicate}
          onViewQuotation={() => setQuotationOpen(true)}
        />
      </div>

      <SubscriptionDetail subscription={subscription} customerName={customerName} planName={planName} />

      <SubscriptionLifecycle status={subscription.status} activity={subscription.activity} />

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        title={`Edit ${subscription.id}`}
        description="Update quantity, billing, dates, terms, and discount."
      >
        <SubscriptionForm
          mode="edit"
          subscription={subscription}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        title="Renew subscription"
        description={`Extend ${subscription.id} for ${customerName}.`}
      >
        <SubscriptionRenewForm
          subscription={subscription}
          onSubmit={handleRenew}
          onCancel={() => setRenewOpen(false)}
        />
      </Modal>

      <Modal
        open={quotationOpen}
        onClose={() => setQuotationOpen(false)}
        size="lg"
        title="Quotation"
        description={`${subscription.quotationNumber} for ${customerName}`}
      >
        <div className="p-5 sm:p-6">
          <SubscriptionQuotation subscription={subscription} customer={customer} planName={planName} />
        </div>
      </Modal>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close this subscription?"
        description={`${subscription.id} for ${customerName} will stop renewing. Its history, invoices, and payments are kept.`}
      >
        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setCloseOpen(false)} className={buttonVariants({ variant: 'secondary' })}>
            Keep active
          </button>
          <button type="button" onClick={handleClose} className={buttonVariants({ variant: 'secondary', className: 'text-error-text' })}>
            Close subscription
          </button>
        </div>
      </Modal>
    </div>
  )
}
