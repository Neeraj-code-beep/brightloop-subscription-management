import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, SearchX } from 'lucide-react'
import ProductsPlansFilters from '../../components/productsPlans/ProductsPlansFilters.jsx'
import ProductsPlansTable from '../../components/productsPlans/ProductsPlansTable.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Input from '../../components/ui/Input.jsx'
import { ROLES } from '../../constants/roles.js'
import useRole from '../../hooks/useRole.js'
import planService from '../../services/planService.js'
import productService from '../../services/productService.js'
import { EMPTY_PRODUCT_FILTERS } from '../../utils/productsPlansQueries.js'

export default function ProductsPlansPage() {
  const { role } = useRole()
  const [plans, setPlans] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_PRODUCT_FILTERS)

  // Create Plan Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productId: '',
    billingCycle: 'MONTHLY',
    price: '',
    setupFee: '0',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansRes, prodsRes] = await Promise.allSettled([
        planService.getPlans({ limit: 100 }),
        productService.getProducts({ limit: 100 }),
      ])

      if (plansRes.status === 'fulfilled') {
        const list = Array.isArray(plansRes.value) ? plansRes.value : plansRes.value?.plans || []
        setPlans(list)
      }
      if (prodsRes.status === 'fulfilled') {
        const list = Array.isArray(prodsRes.value) ? prodsRes.value : prodsRes.value?.products || []
        setProducts(list)
        if (list.length > 0 && !formData.productId) {
          setFormData((prev) => ({ ...prev, productId: list[0].id }))
        }
      }
    } catch (err) {
      console.error('Failed to load products/plans:', err)
      setError(err?.message || 'Failed to load plans from backend')
    } finally {
      setLoading(false)
    }
  }, [formData.productId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rows = useMemo(() => {
    return plans
      .map((p) => {
        const cycle = p.billingCycle || 'MONTHLY'
        const frequencyLabel =
          cycle === 'MONTHLY' ? 'Monthly' : cycle === 'YEARLY' || cycle === 'ANNUAL' ? 'Yearly' : cycle === 'QUARTERLY' ? 'Quarterly' : cycle
        const offer = {
          id: p.id,
          planName: p.name,
          productName: p.product?.name || 'Standard Product',
          type: p.product?.type || 'Service',
          salesPrice: Number(p.price || 0),
          billingFrequency: frequencyLabel,
          status: p.isActive !== false ? 'Active' : 'Archived',
          productSlug: p.product?.slug,
        }
        return {
          offer,
          activeSubscriptions: p._count?.subscriptions || 0,
        }
      })
      .filter(({ offer }) => {
        if (filters.search) {
          const q = filters.search.toLowerCase()
          if (!offer.planName.toLowerCase().includes(q) && !offer.productName.toLowerCase().includes(q)) {
            return false
          }
        }
        if (filters.billingFrequency && filters.billingFrequency !== 'all') {
          if (offer.billingFrequency.toLowerCase() !== filters.billingFrequency.toLowerCase()) return false
        }
        if (filters.status && filters.status !== 'all') {
          if (offer.status.toLowerCase() !== filters.status.toLowerCase()) return false
        }
        return true
      })
  }, [plans, filters])

  const stats = [
    { label: 'Products', value: String(products.length) },
    { label: 'Active plans', value: String(plans.filter((p) => p.isActive !== false).length) },
    { label: 'Monthly plans', value: String(plans.filter((p) => p.billingCycle === 'MONTHLY').length) },
    { label: 'Yearly plans', value: String(plans.filter((p) => p.billingCycle === 'YEARLY' || p.billingCycle === 'ANNUAL').length) },
  ]

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      await planService.createPlan({
        name: formData.name,
        description: formData.description,
        productId: formData.productId,
        billingCycle: formData.billingCycle,
        price: Number(formData.price),
        setupFee: Number(formData.setupFee || 0),
      })
      setCreateOpen(false)
      setFormData({
        name: '',
        description: '',
        productId: products[0]?.id || '',
        billingCycle: 'MONTHLY',
        price: '',
        setupFee: '0',
      })
      await loadData()
    } catch (err) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create plan')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Products & Plans"
          description="Manage the products, plans, pricing, and billing options offered by Brightloop."
        />
        {role === ROLES.ADMIN && (
          <Button variant="primary" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={16} />
            Add Plan
          </Button>
        )}
      </div>

      <StatStrip stats={stats} ariaLabel="Plan summary" />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <ProductsPlansFilters
          filters={filters}
          onChange={updateFilter}
          onClear={() => setFilters(EMPTY_PRODUCT_FILTERS)}
        />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {plans.length} plan offers
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />
            ))}
          </div>
        ) : rows.length > 0 ? (
          <ProductsPlansTable rows={rows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No plan offers match these filters"
              description="Try adjusting your filters or search term to discover plans."
              action={
                <Button variant="secondary" onClick={() => setFilters(EMPTY_PRODUCT_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {createOpen && (
        <Modal
          title="Create New Subscription Plan"
          description="Configure pricing, duration, and link to a core product."
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={handleCreatePlan} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Product
              </label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                required
              >
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} ({prod.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Plan Name
              </label>
              <Input
                required
                className="mt-1"
                placeholder="Enterprise Pro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Description
              </label>
              <Input
                className="mt-1"
                placeholder="Full platform access with dedicated SLA"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Billing Cycle
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  value={formData.billingCycle}
                  onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Recurring Price (INR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  className="mt-1"
                  placeholder="4999.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
