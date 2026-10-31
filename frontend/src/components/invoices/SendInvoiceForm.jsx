import { useState } from 'react'
import { formatINR } from '../../utils/format.js'
import { buttonVariants } from '../ui/buttonStyles.js'

const textareaClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-150 placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

export default function SendInvoiceForm({ invoiceNumber, customerName, total, recipientEmail, onSubmit, onCancel }) {
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({ recipientEmail, message: message.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <dl className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Invoice</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">{invoiceNumber}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Total</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{formatINR(total)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Customer</dt>
            <dd className="text-sm font-medium text-foreground">{customerName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Recipient email</dt>
            <dd className="break-all text-sm font-medium text-foreground">
              {recipientEmail ?? 'No email address on file'}
            </dd>
          </div>
        </dl>

        {recipientEmail ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Message (optional)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add a short note for the customer"
              className={textareaClass}
            />
          </label>
        ) : (
          <p className="text-sm text-error-text">
            Add an email address for this customer before sending this invoice.
          </p>
        )}

        <p className="text-xs text-foreground-subtle">
          Demo only: no email is delivered. The send is recorded in the app and does not change the payment status of the invoice.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!recipientEmail}
          className={buttonVariants({ variant: 'primary' })}
        >
          Send invoice
        </button>
      </div>
    </form>
  )
}
