import { X } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { EMPTY_REPORT_FILTERS, REPORT_INVOICE_STATUSES, REPORT_PERIODS } from '../../utils/reportQueries.js'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-44'

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
    </label>
  )
}

export default function ReportFilters({ filters, productOptions, methodOptions, onChange, onClear, isAdmin }) {
  const canClear = JSON.stringify(filters) !== JSON.stringify(EMPTY_REPORT_FILTERS)

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <FilterSelect label="Filter by period" value={filters.period} onChange={(value) => onChange('period', value)}>
          {REPORT_PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Filter by invoice status" value={filters.status} onChange={(value) => onChange('status', value)}>
          <option value="all">All invoice statuses</option>
          {REPORT_INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Filter by payment method" value={filters.method} onChange={(value) => onChange('method', value)}>
          <option value="all">All payment methods</option>
          {methodOptions.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </FilterSelect>

        {isAdmin && (
          <FilterSelect label="Filter by product" value={filters.product} onChange={(value) => onChange('product', value)}>
            <option value="all">All products</option>
            {productOptions.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </FilterSelect>
        )}
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
        Reset filters
      </button>
    </div>
  )
}
