import { Search, X } from 'lucide-react'
import {
  DISCOUNT_SCOPES,
  DISCOUNT_STATUSES,
  DISCOUNT_TYPES,
  hasActiveDiscountFilters,
} from '../../utils/discountQueries.js'
import { cn } from '../../utils/cn.js'
import Input from '../ui/Input.jsx'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-44'

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="all">{allLabel}</option>
        {options.map((option) => {
          const optionValue = option.value ?? option
          return (
            <option key={optionValue} value={optionValue}>
              {option.label ?? option}
            </option>
          )
        })}
      </select>
    </label>
  )
}

export default function DiscountFilters({ filters, onChange, onClear }) {
  const canClear = hasActiveDiscountFilters(filters)

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search by discount name or code</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          placeholder="Search by discount name or code"
          className="pl-9"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-none lg:items-center">
        <FilterSelect
          label="Filter by status"
          value={filters.status}
          onChange={(value) => onChange('status', value)}
          options={DISCOUNT_STATUSES}
          allLabel="All statuses"
        />
        <FilterSelect
          label="Filter by type"
          value={filters.type}
          onChange={(value) => onChange('type', value)}
          options={DISCOUNT_TYPES}
          allLabel="All types"
        />
        <FilterSelect
          label="Filter by scope"
          value={filters.scope}
          onChange={(value) => onChange('scope', value)}
          options={DISCOUNT_SCOPES}
          allLabel="All scopes"
        />
      </div>

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
