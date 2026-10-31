import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '../ui/buttonStyles.js'
import Field from '../ui/FormField.jsx'
import Input from '../ui/Input.jsx'
import { createEmptyTaxRuleDraft } from '../../services/taxService.js'
import { TAX_STATUSES } from '../../utils/taxQueries.js'
import { cn } from '../../utils/cn.js'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

function withErrorBorder(error) {
  return error ? 'border-error-text focus:border-error-text' : undefined
}

export default function CreateTaxRuleForm({ onSubmit, onCancel }) {
  const [draft, setDraft] = useState(createEmptyTaxRuleDraft)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field) {
    return (event) => {
      const nextValue = event.target.value
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
      <form id="create-tax-rule-form" onSubmit={handleSubmit} noValidate className="space-y-5 px-5 py-5 sm:px-6">
        <Field id="tax-name" label="Tax rule name" error={errors.name}>
          <Input
            id="tax-name"
            value={draft.name}
            onChange={updateField('name')}
            placeholder="e.g. GST 18%"
            maxLength={40}
            aria-invalid={Boolean(errors.name)}
            className={withErrorBorder(errors.name)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tax-rate" label="Rate (%)" hint="Between 0 and 100." error={errors.rate}>
            <Input
              id="tax-rate"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="any"
              value={draft.rate}
              onChange={updateField('rate')}
              aria-invalid={Boolean(errors.rate)}
              className={withErrorBorder(errors.rate)}
            />
          </Field>
          <Field id="tax-status" label="Status" error={errors.status}>
            <select
              id="tax-status"
              value={draft.status}
              onChange={updateField('status')}
              aria-invalid={Boolean(errors.status)}
              className={cn(selectClass, withErrorBorder(errors.status))}
            >
              {TAX_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="tax-description" label="Description" hint="Optional." error={errors.description}>
          <Input
            id="tax-description"
            value={draft.description}
            onChange={updateField('description')}
            placeholder="e.g. Standard GST"
            maxLength={80}
          />
        </Field>
      </form>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button
          type="submit"
          form="create-tax-rule-form"
          disabled={isSaving}
          className={buttonVariants({ variant: 'primary' })}
        >
          {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSaving ? 'Creating...' : 'Create tax rule'}
        </button>
      </div>
    </>
  )
}
