import { useState } from 'react'
import { getCustomerById } from '../../data/customers.js'
import { getPlanById } from '../../data/plans.js'
import { REFERENCE_DATE } from '../../constants/subscriptions.js'
import useDiscounts from '../../hooks/useDiscounts.js'
import { formatINR } from '../../utils/format.js'
import { selectInvoiceDiscount } from '../../utils/discountQueries.js'
import { computeInvoiceTotals } from '../../utils/invoiceMath.js'
import { getApplicableTax } from '../../utils/taxQueries.js'
import useTaxRules from '../../hooks/useTaxRules.js'
import { buttonVariants } from '../ui/buttonStyles.js'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

export default function CreateInvoiceForm({ subscriptions, onSubmit, onCancel }) {
  const [subscriptionId, setSubscriptionId] = useState('')
  const [error, setError] = useState('')
  const selected = subscriptions.find((subscription) => subscription.id === subscriptionId)
  const { discounts } = useDiscounts()
  const { taxRules } = useTaxRules()
  const previewDiscount = selected ? selectInvoiceDiscount(discounts, selected, REFERENCE_DATE) : null
  const previewTax = getApplicableTax(taxRules)
  const totals = selected
    ? computeInvoiceTotals(selected.lines, selected.discountPercent, {
        ruleDiscount: previewDiscount?.amount ?? 0,
        taxRate: previewTax?.rate ?? 0,
      })
    : null

  function handleSubmit(event) {
    event.preventDefault()
    if (!selected) {
      setError('Choose a subscription to bill.')
      return
    }
    onSubmit(selected)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Subscription</span>
          <select
            value={subscriptionId}
            onChange={(event) => {
              setSubscriptionId(event.target.value)
              setError('')
            }}
            className={selectClass}
            aria-invalid={Boolean(error)}
          >
            <option value="">Select a subscription</option>
            {subscriptions.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.id} · {getCustomerById(subscription.customerId)?.name} ·{' '}
                {getPlanById(subscription.planId)?.name}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </label>

        {selected && totals && (
          <dl className="space-y-2 rounded-lg border border-border bg-surface-muted p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Customer</dt>
              <dd className="font-medium text-foreground">{getCustomerById(selected.customerId)?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Payment terms</dt>
              <dd className="font-medium text-foreground">{selected.paymentTerms}</dd>
            </div>
            {previewDiscount && (
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">Discount ({previewDiscount.code})</dt>
                <dd className="font-medium tabular-nums text-foreground">− {formatINR(previewDiscount.amount)}</dd>
              </div>
            )}
            {previewTax && (
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">{previewTax.name} (included)</dt>
                <dd className="font-medium tabular-nums text-foreground">{formatINR(totals.tax)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-border pt-2">
              <dt className="font-semibold text-foreground">Invoice total</dt>
              <dd className="font-semibold tabular-nums text-foreground">{formatINR(totals.total)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button type="submit" className={buttonVariants({ variant: 'primary' })}>
          Create invoice
        </button>
      </div>
    </form>
  )
}
