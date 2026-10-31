import { Search, X } from 'lucide-react'
import { BILLING_FREQUENCIES, SUBSCRIPTION_STATUSES } from '../../constants/subscriptions.js'
import { cn } from '../../utils/cn.js'
import { hasActiveSubscriptionFilters } from '../../utils/subscriptionQueries.js'
import Input from '../ui/Input.jsx'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-40'

export default function SubscriptionFilters({ filters, plans, onChange, onClear }) {
  const canClear = hasActiveSubscriptionFilters(filters)

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search by subscription number or customer</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          placeholder="Search by subscription number or customer"
          className="pl-9"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-none lg:items-center">
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            value={filters.status}
            onChange={(event) => onChange('status', event.target.value)}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filter by billing frequency</span>
          <select
            value={filters.frequency}
            onChange={(event) => onChange('frequency', event.target.value)}
            className={selectClass}
          >
            <option value="all">All frequencies</option>
            {BILLING_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filter by plan</span>
          <select
            value={filters.planId}
            onChange={(event) => onChange('planId', event.target.value)}
            className={selectClass}
          >
            <option value="all">All plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onClear}
        disabled={!canClear}
        className={cn(
          'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          canClear
            ? 'text-primary hover:bg-primary-soft'
            : 'cursor-not-allowed text-foreground-subtle opacity-60',
        )}
      >
        <X size={14} aria-hidden="true" />
        Clear filters
      </button>
    </div>
  )
}
