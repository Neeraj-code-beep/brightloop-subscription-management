import { useState } from 'react'
import { CUSTOMERS, getCustomerById } from '../../data/customers.js'
import { PLANS, getPlanById } from '../../data/plans.js'
import { REFERENCE_DATE } from '../../constants/subscriptions.js'
import { addMonthsToISODate } from '../../utils/subscriptionMath.js'
import { buttonVariants } from '../ui/buttonStyles.js'
import { ConfigureStep, CustomerStep, PlanStep, ReviewStep } from './SubscriptionFormSteps.jsx'

const CREATE_STEPS = [
  { id: 'customer', label: 'Select customer' },
  { id: 'plan', label: 'Select plan' },
  { id: 'configure', label: 'Configure' },
  { id: 'review', label: 'Review' },
]

const EDIT_STEPS = CREATE_STEPS.slice(2)

function initialValues(subscription) {
  if (!subscription) {
    return {
      customerId: '',
      planId: '',
      quantity: '1',
      billingFrequency: 'Monthly',
      startDate: REFERENCE_DATE,
      expiryDate: addMonthsToISODate(REFERENCE_DATE, 12),
      paymentTerms: 'Net 15',
      discountPercent: '0',
    }
  }

  return {
    customerId: subscription.customerId,
    planId: subscription.planId,
    quantity: String(subscription.lines[0].quantity),
    billingFrequency: subscription.billingFrequency,
    startDate: subscription.startDate,
    expiryDate: subscription.expiryDate,
    paymentTerms: subscription.paymentTerms,
    discountPercent: String(subscription.discountPercent),
  }
}

function validateStep(stepId, values) {
  const errors = {}

  if (stepId === 'customer' && !values.customerId) {
    errors.customerId = 'Select a customer to continue.'
  }

  if (stepId === 'plan' && !values.planId) {
    errors.planId = 'Select a plan to continue.'
  }

  if (stepId === 'configure') {
    const quantity = Number(values.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      errors.quantity = 'Enter a whole number between 1 and 999.'
    }

    if (!values.startDate) {
      errors.startDate = 'Choose a start date.'
    }

    if (!values.expiryDate) {
      errors.expiryDate = 'Choose an expiry date.'
    } else if (values.startDate && values.expiryDate <= values.startDate) {
      errors.expiryDate = 'Expiry must be after the start date.'
    }

    const discount = Number(values.discountPercent)
    if (values.discountPercent === '' || Number.isNaN(discount) || discount < 0 || discount > 100) {
      errors.discountPercent = 'Enter a discount between 0 and 100.'
    }
  }

  return errors
}

function buildPayload(values) {
  return {
    customerId: values.customerId,
    planId: values.planId,
    quantity: Number(values.quantity),
    billingFrequency: values.billingFrequency,
    startDate: values.startDate,
    expiryDate: values.expiryDate,
    paymentTerms: values.paymentTerms,
    discountPercent: Number(values.discountPercent),
  }
}

export default function SubscriptionForm({ mode, subscription, onSubmit, onCancel }) {
  const steps = mode === 'edit' ? EDIT_STEPS : CREATE_STEPS
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState(() => initialValues(subscription))
  const [errors, setErrors] = useState({})

  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const customer = getCustomerById(values.customerId)
  const plan = getPlanById(values.planId)
  const quantity = Number(values.quantity)

  function updateField(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  function handleNext() {
    const stepErrors = validateStep(step.id, values)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return

    if (isLastStep) {
      onSubmit(buildPayload(values))
      return
    }
    setStepIndex((index) => index + 1)
  }

  function handleBack() {
    setErrors({})
    setStepIndex((index) => Math.max(0, index - 1))
  }

  const lockedNotice =
    mode === 'edit' && customer && plan
      ? `${customer.name} on the ${plan.name} plan. The customer and plan stay the same when editing.`
      : null

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        handleNext()
      }}
    >
      <div className="space-y-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-foreground-subtle">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span className="text-foreground-muted">{step.label}</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((item, index) => (
            <span
              key={item.id}
              className={
                index <= stepIndex ? 'h-1.5 rounded-full bg-primary' : 'h-1.5 rounded-full bg-border'
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {step.id === 'customer' && (
          <CustomerStep
            customers={CUSTOMERS}
            value={values.customerId}
            onChange={(customerId) => updateField('customerId', customerId)}
            error={errors.customerId}
          />
        )}
        {step.id === 'plan' && (
          <PlanStep
            plans={PLANS}
            value={values.planId}
            billingFrequency={values.billingFrequency}
            onChange={(planId) => updateField('planId', planId)}
            error={errors.planId}
          />
        )}
        {step.id === 'configure' && (
          <ConfigureStep
            values={values}
            errors={errors}
            onChange={updateField}
            lockedNotice={lockedNotice}
          />
        )}
        {step.id === 'review' && customer && plan && (
          <ReviewStep customer={customer} plan={plan} values={values} quantity={quantity} />
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        {stepIndex === 0 ? (
          <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
            Cancel
          </button>
        ) : (
          <button type="button" onClick={handleBack} className={buttonVariants({ variant: 'secondary' })}>
            Back
          </button>
        )}
        <button type="submit" className={buttonVariants({ variant: 'primary' })}>
          {isLastStep ? (mode === 'edit' ? 'Save changes' : 'Create Subscription') : 'Continue'}
        </button>
      </div>
    </form>
  )
}
