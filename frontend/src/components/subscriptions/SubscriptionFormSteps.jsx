import { useState } from 'react'
import {
  BILLING_FREQUENCY_UNITS,
  BILLING_FREQUENCIES,
  PAYMENT_TERMS,
  TAX_RATE_PERCENT,
} from '../../constants/subscriptions.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { computeTotals } from '../../utils/subscriptionMath.js'
import { cn } from '../../utils/cn.js'
import Input from '../ui/Input.jsx'

const fieldSelectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

function choiceClass(selected) {
  return cn(
    'w-full rounded-lg border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-border bg-surface hover:bg-surface-hover',
  )
}

function FieldError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1.5 text-xs text-error-text">
      {message}
    </p>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  )
}

export function CustomerStep({ customers, value, onChange, error }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const matches = customers.filter((customer) =>
    `${customer.name} ${customer.contact} ${customer.city}`.toLowerCase().includes(normalizedQuery),
  )

  return (
    <div className="space-y-4">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by company, contact or city"
        aria-label="Search customers"
      />
      <div role="radiogroup" aria-label="Customer" className="grid gap-2 sm:grid-cols-2">
        {matches.map((customer) => {
          const selected = customer.id === value
          return (
            <button
              key={customer.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(customer.id)}
              className={choiceClass(selected)}
            >
              <span className="block truncate text-sm font-medium text-foreground">{customer.name}</span>
              <span className="block truncate text-xs text-foreground-subtle">
                {customer.contact} · {customer.city}
              </span>
            </button>
          )
        })}
      </div>
      {matches.length === 0 && <p className="text-sm text-foreground-muted">No customers match your search.</p>}
      <FieldError message={error} />
    </div>
  )
}

export function PlanStep({ plans, billingFrequency, value, onChange, error }) {
  const unit = BILLING_FREQUENCY_UNITS[billingFrequency]

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const selected = plan.id === value
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(plan.id)}
              className={choiceClass(selected)}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatINR(plan.prices[billingFrequency])}
                  <span className="text-xs font-normal text-foreground-subtle"> / {unit}</span>
                </span>
              </span>
              <ul className="mt-2 space-y-1">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="text-xs text-foreground-muted">
                    {benefit}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
      <FieldError message={error} />
    </div>
  )
}

export function ConfigureStep({ values, errors, onChange, lockedNotice }) {
  return (
    <div className="space-y-5">
      {lockedNotice && (
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-foreground-muted">{lockedNotice}</p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Quantity" error={errors.quantity}>
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={values.quantity}
            onChange={(event) => onChange('quantity', event.target.value)}
          />
        </Field>
        <Field label="Billing frequency">
          <select
            value={values.billingFrequency}
            onChange={(event) => onChange('billingFrequency', event.target.value)}
            className={fieldSelectClass}
          >
            {BILLING_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date" error={errors.startDate}>
          <Input
            type="date"
            value={values.startDate}
            onChange={(event) => onChange('startDate', event.target.value)}
          />
        </Field>
        <Field label="Expiry date" error={errors.expiryDate}>
          <Input
            type="date"
            value={values.expiryDate}
            onChange={(event) => onChange('expiryDate', event.target.value)}
          />
        </Field>
        <Field label="Payment terms">
          <select
            value={values.paymentTerms}
            onChange={(event) => onChange('paymentTerms', event.target.value)}
            className={fieldSelectClass}
          >
            {PAYMENT_TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Discount (%)" error={errors.discountPercent}>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            inputMode="decimal"
            value={values.discountPercent}
            onChange={(event) => onChange('discountPercent', event.target.value)}
          />
        </Field>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2 text-sm', strong && 'border-t border-border pt-3')}>
      <dt className={cn(strong ? 'font-semibold text-foreground' : 'text-foreground-muted')}>{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'text-base font-semibold text-foreground' : 'text-foreground')}>
        {value}
      </dd>
    </div>
  )
}

export function ReviewStep({ customer, plan, values, quantity }) {
  const unitPrice = plan.prices[values.billingFrequency]
  const discountPercent = Number(values.discountPercent) || 0
  const totals = computeTotals([{ quantity, unitPrice }], discountPercent)

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <dl className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
        <div className="py-3">
          <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Customer</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{customer.name}</dd>
          <dd className="text-xs text-foreground-subtle">{customer.city}</dd>
        </div>
        <div className="py-3">
          <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Plan</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {plan.name} × {quantity}
          </dd>
          <dd className="text-xs text-foreground-subtle">
            {values.billingFrequency} · {formatINR(unitPrice)} per unit
          </dd>
        </div>
        <div className="py-3">
          <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Term</dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatDate(values.startDate)} to {formatDate(values.expiryDate)}
          </dd>
          <dd className="text-xs text-foreground-subtle">Payment terms: {values.paymentTerms}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-border bg-surface-muted px-4 py-2">
        <dl>
          <SummaryRow label="Subtotal" value={formatINR(totals.subtotal)} />
          <SummaryRow label="Discount" value={`- ${formatINR(totals.discount)}`} />
          <SummaryRow label={`Tax (${TAX_RATE_PERCENT}%, included)`} value={formatINR(totals.tax)} />
          <SummaryRow label="Total per cycle" value={formatINR(totals.total)} strong />
        </dl>
      </div>
    </div>
  )
}
