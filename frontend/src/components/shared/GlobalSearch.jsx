import { CreditCard, FileText, Package, Repeat, Search, UserRound, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSearchIndex from '../../hooks/useSearchIndex.js'
import { SEARCH_MIN_LENGTH, searchIndex } from '../../utils/globalSearch.js'
import { cn } from '../../utils/cn.js'

const TYPE_ICONS = {
  customer: Users,
  subscription: Repeat,
  invoice: FileText,
  payment: CreditCard,
  plan: Package,
  account: UserRound,
}

function Highlighted({ text, query }) {
  const start = text.toLowerCase().indexOf(query)
  if (start === -1) return text
  const end = start + query.length
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary-soft text-foreground">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

export default function GlobalSearch({ className, autoFocus = false, onNavigate }) {
  const navigate = useNavigate()
  const index = useSearchIndex()
  const rootRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const normalizedQuery = query.trim().toLowerCase()
  const canSearch = normalizedQuery.length >= SEARCH_MIN_LENGTH
  const groups = useMemo(() => searchIndex(index, query), [index, query])
  const flatResults = useMemo(() => groups.flatMap((group) => group.results), [groups])
  const showDropdown = open && canSearch

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleChange(event) {
    setQuery(event.target.value)
    setOpen(true)
    setActiveIndex(0)
  }

  function clearSearch() {
    setQuery('')
    setOpen(false)
    rootRef.current?.querySelector('input')?.focus()
  }

  function openResult(result) {
    setQuery('')
    setOpen(false)
    navigate(result.to)
    onNavigate?.()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!showDropdown || flatResults.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + step + flatResults.length) % flatResults.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      openResult(flatResults[activeIndex] ?? flatResults[0])
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label className="relative block">
        <span className="sr-only">Search</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <input
          type="search"
          autoFocus={autoFocus}
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search invoices, customers..."
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="h-10 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-9 text-sm text-foreground transition-colors duration-150 placeholder:text-foreground-subtle focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground-subtle transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>

      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {flatResults.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-foreground-muted">No results found</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-2">
              {groups.map((group) => (
                <div key={group.type}>
                  <p className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                    {group.label}
                  </p>
                  <ul role="listbox" aria-label={group.label}>
                    {group.results.map((result) => {
                      const Icon = TYPE_ICONS[result.type]
                      const isActive = flatResults[activeIndex] === result
                      return (
                        <li key={`${result.type}-${result.id}`} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => openResult(result)}
                            onMouseEnter={() => setActiveIndex(flatResults.indexOf(result))}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150',
                              isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                            )}
                          >
                            <Icon size={16} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                <Highlighted text={result.title} query={normalizedQuery} />
                              </span>
                              <span className="block truncate text-xs text-foreground-subtle">
                                <Highlighted text={result.detail} query={normalizedQuery} />
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
