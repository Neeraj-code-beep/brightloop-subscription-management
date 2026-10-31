import { useState } from 'react'
import { PAYMENT_METHODS } from '../../constants/invoices.js'
import { REFERENCE_DATE } from '../../constants/subscriptions.js'
import { formatINR } from '../../utils/format.js'
import { buttonVariants } from '../ui/buttonStyles.js'
import Input from '../ui/Input.jsx'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-error-text">{message}</p>
}

export default function InvoicePaymentForm({ invoiceNumber, customerName, amountOutstanding, onSubmit, onCancel }) {
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState({
    amount: String(amountOutstanding),
    date: REFERENCE_DATE,
    method: PAYMENT_METHODS[0],
    reference: '',
  })
  const [errors, setErrors] = useState({})

  function updateField(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const amount = Number(values.amount)
    const nextErrors = {}
    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = 'Enter an amount greater than zero.'
    } else if (amount > amountOutstanding) {
      nextErrors.amount = `Enter an amount up to ${formatINR(amountOutstanding)}.`
    }
    if (!values.date) nextErrors.date = 'Choose the date the payment was received.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({ date: values.date, method: values.method, amount, reference: values.reference.trim() })
    } catch (err) {
      setErrors({ form: err?.message || 'Failed to record payment' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <dl className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Invoice</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">{invoiceNumber}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Customer</dt>
            <dd className="text-sm font-medium text-foreground">{customerName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Outstanding</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{formatINR(amountOutstanding)}</dd>
          </div>
        </dl>

        {errors.form && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {errors.form}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Amount received</span>
            <Input
              type="number"
              min="1"
              max={amountOutstanding}
              step="1"
              inputMode="numeric"
              value={values.amount}
              onChange={(event) => updateField('amount', event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              disabled={submitting}
            />
            <FieldError message={errors.amount} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Payment date</span>
            <Input
              type="date"
              value={values.date}
              onChange={(event) => updateField('date', event.target.value)}
              aria-invalid={Boolean(errors.date)}
              disabled={submitting}
            />
            <FieldError message={errors.date} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Payment method</span>
            <select
              value={values.method}
              onChange={(event) => updateField('method', event.target.value)}
              className={selectClass}
              disabled={submitting}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Note or reference (optional)</span>
            <Input
              type="text"
              maxLength={120}
              value={values.reference}
              onChange={(event) => updateField('reference', event.target.value)}
              placeholder="e.g. UTR or cheque number"
              disabled={submitting}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} disabled={submitting} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={buttonVariants({ variant: 'primary' })}>
          {submitting ? 'Recording...' : 'Record payment'}
        </button>
      </div>
    </form>
  )
}
