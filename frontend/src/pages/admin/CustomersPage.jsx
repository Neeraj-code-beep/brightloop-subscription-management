import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, SearchX } from 'lucide-react'
import CustomerFilters from '../../components/customers/CustomerFilters.jsx'
import CustomerTable from '../../components/customers/CustomerTable.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Input from '../../components/ui/Input.jsx'
import customerService from '../../services/customerService.js'
import { formatINR } from '../../utils/format.js'
import { EMPTY_CUSTOMER_FILTERS } from '../../utils/customerQueries.js'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_CUSTOMER_FILTERS)

  // Create Customer Modal State
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    customerType: 'INDIVIDUAL',
  })

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await customerService.getCustomers({ limit: 100 })
      const list = Array.isArray(res) ? res : res?.customers || res?.data || []
      setCustomers(list)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
      setError(err?.message || 'Failed to load customers from backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const rows = useMemo(() => {
    return customers
      .map((c) => {
        const name = c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email
        const activeSub = c.subscriptions?.find((s) => s.status === 'ACTIVE') || c.subscriptions?.[0]
        return {
          customer: {
            id: c.id,
            name,
            contact: c.phone || c.email,
            city: c.city || '—',
          },
          email: c.email,
          subscription: activeSub
            ? {
                id: activeSub.subscriptionNumber || activeSub.id,
                planName: activeSub.plan?.name || 'Standard Plan',
                billingFrequency: activeSub.billingCycle || 'Monthly',
              }
            : null,
          billing: {
            outstanding: Number(c.outstandingBalance || c.totalOutstandingAmount || 0),
            openInvoices: c._count?.invoices || 0,
          },
          status: c.status === 'ACTIVE' || c.isActive ? 'Active' : 'Inactive',
        }
      })
      .filter((row) => {
        if (filters.search) {
          const q = filters.search.toLowerCase()
          const matchName = row.customer.name.toLowerCase().includes(q)
          const matchEmail = (row.email || '').toLowerCase().includes(q)
          const matchId = row.customer.id.toLowerCase().includes(q)
          if (!matchName && !matchEmail && !matchId) return false
        }
        if (filters.status && filters.status !== 'all') {
          if (row.status.toLowerCase() !== filters.status.toLowerCase()) return false
        }
        return true
      })
  }, [customers, filters])

  const totals = useMemo(() => {
    const total = customers.length
    const activeSubscriptions = customers.reduce((acc, c) => {
      const activeCount = c.subscriptions?.filter((s) => s.status === 'ACTIVE').length || 0
      return acc + activeCount
    }, 0)
    const outstanding = customers.reduce((acc, c) => {
      return acc + Number(c.outstandingBalance || c.totalOutstandingAmount || 0)
    }, 0)

    return { total, activeSubscriptions, outstanding, openInvoices: customers.length }
  }, [customers])

  const stats = [
    { label: 'Customers', value: String(totals.total) },
    { label: 'Active subscriptions', value: String(totals.activeSubscriptions) },
    { label: 'Outstanding', value: formatINR(totals.outstanding) },
    { label: 'Registered Accounts', value: String(customers.length) },
  ]

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      await customerService.createCustomer(formData)
      setCreateOpen(false)
      setFormData({
        firstName: '',
        lastName: '',
        companyName: '',
        email: '',
        phone: '',
        customerType: 'INDIVIDUAL',
      })
      await fetchCustomers()
    } catch (err) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create customer')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Customers"
          description="Review customer accounts, their subscriptions, and outstanding balances."
        />
        <Button variant="primary" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus size={16} />
          Add Customer
        </Button>
      </div>

      <StatStrip stats={stats} ariaLabel="Customer summary" />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <CustomerFilters
          filters={filters}
          onChange={updateFilter}
          onClear={() => setFilters(EMPTY_CUSTOMER_FILTERS)}
        />

        <p className="text-sm text-foreground-muted">
          Showing {rows.length} of {customers.length} customers
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />
            ))}
          </div>
        ) : rows.length > 0 ? (
          <CustomerTable rows={rows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No customers match these filters"
              description="Try a different search term or clear the filters to see every customer."
              action={
                <Button variant="secondary" onClick={() => setFilters(EMPTY_CUSTOMER_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {/* Create Customer Modal */}
      {createOpen && (
        <Modal
          title="Add New Customer"
          description="Register a new customer profile for billing and subscriptions."
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  First Name
                </label>
                <Input
                  required
                  className="mt-1"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Arun"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Last Name
                </label>
                <Input
                  required
                  className="mt-1"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Kumar"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Company Name (Optional)
              </label>
              <Input
                className="mt-1"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Vertex Labs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Email Address
              </label>
              <Input
                type="email"
                required
                className="mt-1"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="arun@vertex.io"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Phone Number
              </label>
              <Input
                className="mt-1"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Saving...' : 'Create Customer'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
