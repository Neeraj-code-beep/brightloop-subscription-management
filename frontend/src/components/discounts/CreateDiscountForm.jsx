import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '../ui/buttonStyles.js'
import Input from '../ui/Input.jsx'
import Field from '../ui/FormField.jsx'
import { DISCOUNT_TYPES, getAppliesToGroups } from '../../utils/discountQueries.js'
import { createEmptyDiscountDraft } from '../../services/discountService.js'
import { cn } from '../../utils/cn.js'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

const appliesToGroups = getAppliesToGroups()

function Section({ title, description, children }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {description && <p className="text-xs text-foreground-muted">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function withErrorBorder(error) {
  return error ? 'border-error-text focus:border-error-text' : undefined
}

export default function CreateDiscountForm({ onSubmit, onCancel }) {
  const [draft, setDraft] = useState(createEmptyDiscountDraft)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const valueLabel = { Percentage: 'Percentage (%)', Fixed: 'Amount (INR)' }[draft.type] ?? 'Value'
  const valueHint = {
    Percentage: 'Enter a percentage up to 100.',
    Fixed: 'Fixed amount taken off the invoice.',
  }[draft.type]

  function updateField(field) {
    return (event) => {
      const nextValue = field === 'code' ? event.target.value.toUpperCase() : event.target.value
      setDraft((previous) => ({ ...previous, [field]: nextValue }))
      setErrors((previous) => {
        if (!previous[field]) return previous
        const next = { ...previous }
        delete next[field]
        return next
      })
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    const submitErrors = onSubmit(draft)
    if (submitErrors) {
      setErrors(submitErrors)
      setIsSaving(false)
    }
  }

  return (
    <>
      <form id="create-discount-form" onSubmit={handleSubmit} noValidate className="space-y-8 px-5 py-5 sm:px-6">
      <Section title="Basic details">
        <Field id="discount-name" label="Discount name" error={errors.name}>
          <Input
            id="discount-name"
            value={draft.name}
            onChange={updateField('name')}
            placeholder="e.g. Festive offer"
            maxLength={80}
            aria-invalid={Boolean(errors.name)}
            className={withErrorBorder(errors.name)}
          />
        </Field>
        <Field id="discount-code" label="Discount code" hint="Letters, numbers, hyphens, or underscores." error={errors.code}>
          <Input
            id="discount-code"
            value={draft.code}
            onChange={updateField('code')}
            placeholder="e.g. FESTIVE15"
            maxLength={30}
            autoComplete="off"
            aria-invalid={Boolean(errors.code)}
            className={cn('uppercase', withErrorBorder(errors.code))}
          />
        </Field>
      </Section>

      <Section title="Type and value">
        <Field id="discount-type" label="Discount type" error={errors.type}>
          <select
            id="discount-type"
            value={draft.type}
            onChange={updateField('type')}
            aria-invalid={Boolean(errors.type)}
            className={cn(selectClass, withErrorBorder(errors.type))}
          >
            <option value="">Select a type</option>
            {DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field id="discount-value" label={valueLabel} hint={valueHint} error={errors.value}>
          <Input
            id="discount-value"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.value}
            onChange={updateField('value')}
            aria-invalid={Boolean(errors.value)}
            className={withErrorBorder(errors.value)}
          />
        </Field>
      </Section>

      <Section title="Applies to">
        <Field id="discount-applies-to" label="Applies to" error={errors.appliesTo} hint="Choose all subscriptions or one product or plan.">
          <select
            id="discount-applies-to"
            value={draft.appliesTo}
            onChange={updateField('appliesTo')}
            aria-invalid={Boolean(errors.appliesTo)}
            className={cn(selectClass, withErrorBorder(errors.appliesTo))}
          >
            <option value="subscriptions">All subscriptions</option>
            {appliesToGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Conditions" description="Optional. Leave blank if the discount has no minimum.">
        <Field id="discount-min-purchase" label="Minimum purchase (INR)" error={errors.minPurchaseAmount}>
          <Input
            id="discount-min-purchase"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.minPurchaseAmount}
            onChange={updateField('minPurchaseAmount')}
            aria-invalid={Boolean(errors.minPurchaseAmount)}
            className={withErrorBorder(errors.minPurchaseAmount)}
          />
        </Field>
        <Field id="discount-min-quantity" label="Minimum quantity" error={errors.minQuantity}>
          <Input
            id="discount-min-quantity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={draft.minQuantity}
            onChange={updateField('minQuantity')}
            aria-invalid={Boolean(errors.minQuantity)}
            className={withErrorBorder(errors.minQuantity)}
          />
        </Field>
      </Section>

      <Section title="Validity">
        <Field id="discount-start" label="Start date" error={errors.startDate}>
          <Input
            id="discount-start"
            type="date"
            value={draft.startDate}
            onChange={updateField('startDate')}
            aria-invalid={Boolean(errors.startDate)}
            className={withErrorBorder(errors.startDate)}
          />
        </Field>
        <Field id="discount-end" label="End date" hint="Leave blank for no end date." error={errors.endDate}>
          <Input
            id="discount-end"
            type="date"
            value={draft.endDate}
            onChange={updateField('endDate')}
            aria-invalid={Boolean(errors.endDate)}
            className={withErrorBorder(errors.endDate)}
          />
        </Field>
      </Section>

      <Section title="Usage limit">
        <Field id="discount-usage-limit" label="Maximum uses" hint="Leave blank for unlimited uses." error={errors.usageLimit}>
          <Input
            id="discount-usage-limit"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={draft.usageLimit}
            onChange={updateField('usageLimit')}
            aria-invalid={Boolean(errors.usageLimit)}
            className={withErrorBorder(errors.usageLimit)}
          />
        </Field>
      </Section>
      </form>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button
          type="submit"
          form="create-discount-form"
          disabled={isSaving}
          className={buttonVariants({ variant: 'primary' })}
        >
          {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSaving ? 'Creating...' : 'Create discount'}
        </button>
      </div>
    </>
  )
}
