import { Search, X } from 'lucide-react'
import { PAYMENT_METHODS } from '../../constants/invoices.js'
import { cn } from '../../utils/cn.js'
import { hasActivePaymentFilters } from '../../utils/paymentQueries.js'
import Input from '../ui/Input.jsx'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-44'

export default function PaymentFilters({ filters, onChange, onClear }) {
  const canClear = hasActivePaymentFilters(filters)

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search by payment, invoice number, or customer</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          placeholder="Search by payment, invoice, or customer"
          className="pl-9"
        />
      </label>

      <label className="lg:flex-none">
        <span className="sr-only">Filter by payment method</span>
        <select value={filters.method} onChange={(event) => onChange('method', event.target.value)} className={selectClass}>
          <option value="all">All methods</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onClear}
        disabled={!canClear}
        className={cn(
          'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          canClear ? 'text-primary hover:bg-primary-soft' : 'cursor-not-allowed text-foreground-subtle opacity-60',
        )}
      >
        <X size={14} aria-hidden="true" />
        Clear filters
      </button>
    </div>
  )
}
