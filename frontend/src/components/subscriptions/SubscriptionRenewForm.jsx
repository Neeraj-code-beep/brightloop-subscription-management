import { useState } from 'react'
import FormField from '../ui/FormField.jsx'
import Input from '../ui/Input.jsx'
import { buttonVariants } from '../ui/buttonStyles.js'
import { validateRenewalExpiry } from '../../services/subscriptionLifecycleService.js'
import { addBillingPeriod } from '../../utils/subscriptionMath.js'
import { formatDate } from '../../utils/format.js'

export default function SubscriptionRenewForm({ subscription, onSubmit, onCancel }) {
  const [expiryDate, setExpiryDate] = useState(() => addBillingPeriod(subscription.expiryDate, subscription.billingFrequency))
  const [error, setError] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateRenewalExpiry(subscription, expiryDate)
    if (validationError) {
      setError(validationError)
      return
    }
    onSubmit(expiryDate)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <p className="text-sm text-foreground-muted">
          The current term ends on {formatDate(subscription.expiryDate)}. Choose when the renewed term should end. No
          invoice is created by renewing.
        </p>
        <FormField
          id="renew-expiry-date"
          label="New expiry date"
          error={error}
          hint="Defaults to one billing period after the current expiry."
        >
          <Input
            id="renew-expiry-date"
            type="date"
            value={expiryDate}
            min={subscription.expiryDate}
            onChange={(event) => {
              setExpiryDate(event.target.value)
              setError(null)
            }}
            aria-invalid={error ? 'true' : undefined}
          />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button type="submit" className={buttonVariants({ variant: 'primary' })}>
          Renew subscription
        </button>
      </div>
    </form>
  )
}
