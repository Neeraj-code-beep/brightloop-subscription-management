import { Plus, SearchX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import CreateDiscountForm from '../../components/discounts/CreateDiscountForm.jsx'
import DiscountFilters from '../../components/discounts/DiscountFilters.jsx'
import DiscountTable from '../../components/discounts/DiscountTable.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { ROLES } from '../../constants/roles.js'
import useDiscounts from '../../hooks/useDiscounts.js'
import useRole from '../../hooks/useRole.js'
import useToast from '../../hooks/useToast.js'
import {
  buildDiscountRows,
  EMPTY_DISCOUNT_FILTERS,
  filterDiscountRows,
  hasActiveDiscountFilters,
  summarizeDiscountRows,
} from '../../utils/discountQueries.js'

export default function DiscountsPage() {
  const { role } = useRole()
  const { discounts, createDiscount } = useDiscounts()
  const { showToast } = useToast()
  const [filters, setFilters] = useState(EMPTY_DISCOUNT_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)

  const allRows = useMemo(() => buildDiscountRows(discounts), [discounts])
  const summary = useMemo(() => summarizeDiscountRows(allRows), [allRows])
  const rows = useMemo(() => filterDiscountRows(allRows, filters), [allRows, filters])

  const stats = [
    { label: 'Active discounts', value: String(summary.active) },
    { label: 'Total discount rules', value: String(summary.total) },
    { label: 'Expiring soon', value: String(summary.expiringSoon) },
    { label: 'Usage limited', value: String(summary.usageLimited) },
  ]

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const handleCreate = useCallback(
    (draft) => {
      const result = createDiscount(draft)
      if (result.errors) return result.errors

      setCreateOpen(false)
      showToast({ title: `Discount ${result.discount.code} created successfully` })
      return null
    },
    [createDiscount, showToast],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Manage promotional rules and discounts applied to subscription invoices."
        action={
          role === ROLES.ADMIN && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={buttonVariants({ variant: 'primary' })}
            >
              <Plus size={16} aria-hidden="true" />
              New Discount
            </button>
          )
        }
      />

      <StatStrip stats={stats} ariaLabel="Discount summary" />

      <Modal
        open={createOpen}
        onClose={closeCreate}
        size="lg"
        title="New Discount"
        description="Create a discount rule for subscriptions, products, or plans."
      >
        <CreateDiscountForm onSubmit={handleCreate} onCancel={closeCreate} />
      </Modal>

      <div className="space-y-4">
        <DiscountFilters
          filters={filters}
          onChange={updateFilter}
          onClear={() => setFilters(EMPTY_DISCOUNT_FILTERS)}
        />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {allRows.length} discounts
        </p>

        {rows.length > 0 ? (
          <DiscountTable rows={rows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No discounts match these filters"
              description="Try a different search term or clear the filters to see every discount."
              action={
                hasActiveDiscountFilters(filters) && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_DISCOUNT_FILTERS)}
                    className={buttonVariants({ variant: 'secondary' })}
                  >
                    Clear filters
                  </button>
                )
              }
            />
          </Card>
        )}
      </div>
    </div>
  )
}
