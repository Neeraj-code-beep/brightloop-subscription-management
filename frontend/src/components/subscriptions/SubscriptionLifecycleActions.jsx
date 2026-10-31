import { ChevronDown, FileText } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '../ui/buttonStyles.js'
import { LIFECYCLE_ACTIONS, canGenerateInvoice } from '../../services/subscriptionLifecycleService.js'

const LIFECYCLE_BUTTONS = [
  { action: LIFECYCLE_ACTIONS.CREATE_QUOTATION, label: 'Create quotation' },
  { action: LIFECYCLE_ACTIONS.RETURN_TO_DRAFT, label: 'Back to draft' },
  { action: LIFECYCLE_ACTIONS.CONFIRM, label: 'Confirm' },
  { action: LIFECYCLE_ACTIONS.ACTIVATE, label: 'Activate' },
  { action: LIFECYCLE_ACTIONS.PAUSE, label: 'Pause' },
  { action: LIFECYCLE_ACTIONS.RESUME, label: 'Resume' },
  { action: LIFECYCLE_ACTIONS.RENEW, label: 'Renew' },
]

const groupLabelClass = 'text-xs font-medium uppercase tracking-wider text-foreground-subtle'
const menuItemClass =
  'w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover'

export default function SubscriptionLifecycleActions({
  subscription,
  availableActions,
  onLifecycleAction,
  onClose,
  onEdit,
  onGenerateInvoice,
  onDuplicate,
  onViewQuotation,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isClosed = subscription.status === 'Closed'
  const invoiceAllowed = canGenerateInvoice(subscription)
  const visibleLifecycle = LIFECYCLE_BUTTONS.filter(({ action }) => availableActions[action])

  function handleMoreAction(callback) {
    setMoreOpen(false)
    callback()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={groupLabelClass}>Lifecycle</span>
          {visibleLifecycle.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              onClick={() => onLifecycleAction(action)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {label}
            </button>
          ))}
          {availableActions[LIFECYCLE_ACTIONS.CLOSE] && (
            <button
              type="button"
              onClick={onClose}
              className={buttonVariants({ variant: 'secondary', className: 'text-error-text' })}
            >
              Close subscription
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={groupLabelClass}>Billing</span>
          <button
            type="button"
            onClick={onGenerateInvoice}
            disabled={!invoiceAllowed}
            className={buttonVariants({ variant: 'primary' })}
          >
            <FileText size={16} aria-hidden="true" />
            Generate Invoice
          </button>
        </div>

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
              {subscription.quotationNumber && (
                <button type="button" role="menuitem" onClick={() => handleMoreAction(onViewQuotation)} className={menuItemClass}>
                  View quotation
                </button>
              )}
              {!isClosed && (
                <button type="button" role="menuitem" onClick={() => handleMoreAction(onEdit)} className={menuItemClass}>
                  Edit details
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => handleMoreAction(onDuplicate)} className={menuItemClass}>
                Duplicate as draft
              </button>
            </div>
          )}
        </div>
      </div>

      {!invoiceAllowed && !isClosed && (
        <p className="text-xs text-foreground-subtle">
          Invoices can be generated once the subscription is confirmed or active, and it is not paused.
        </p>
      )}
    </div>
  )
}
