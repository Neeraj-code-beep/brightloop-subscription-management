import React, { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import RecentPaymentsList from '../../components/dashboard/RecentPaymentsList.jsx'
import Card from '../../components/ui/Card.jsx'
import useAuth from '../../hooks/useAuth.js'
import customerService from '../../services/customerService.js'

export default function CustomerPaymentsPage() {
  const { user, customerId } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    customerService
      .getPayments(customerId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.payments || []
        setPayments(list)
      })
      .catch((err) => console.warn('Failed to load customer payments:', err))
      .finally(() => setLoading(false))
  }, [customerId])

  const items = payments.map((p) => ({
    id: p.paymentNumber || p.id,
    customer: user?.name || 'My Account',
    amount: Number(p.amount || 0),
    method: p.paymentMethod || 'Online',
    date: p.paymentDate || p.createdAt,
    status: p.status === 'SUCCEEDED' ? 'Captured' : p.status,
  }))

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="My Payments" description="Payments received from your account" />
      <div className="max-w-3xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <RecentPaymentsList title="Payments" description="Most recent first" payments={items} />
        ) : (
          <Card>
            <EmptyState
              icon={CreditCard}
              title="No payments yet"
              description="Payments made on your invoices will appear here."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
