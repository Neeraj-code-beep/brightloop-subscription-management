import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import InvoiceTable from '../../components/invoices/InvoiceTable.jsx'
import Card from '../../components/ui/Card.jsx'
import useAuth from '../../hooks/useAuth.js'
import customerService from '../../services/customerService.js'

export default function CustomerInvoicesPage() {
  const { user, customerId } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    customerService
      .getInvoices(customerId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.invoices || []
        setInvoices(list)
      })
      .catch((err) => console.warn('Failed to load customer invoices:', err))
      .finally(() => setLoading(false))
  }, [customerId])

  const rows = invoices.map((inv) => ({
    invoice: {
      id: inv.id,
      number: inv.invoiceNumber || inv.id,
      subscriptionId: inv.subscription?.subscriptionNumber || inv.subscriptionId || '—',
      issueDate: inv.issueDate || inv.createdAt,
      dueDate: inv.dueDate,
    },
    customerName: user?.name || 'My Account',
    total: Number(inv.totalAmount || 0),
    status: inv.status,
  }))

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="My Invoices" description="Every invoice issued to your account" />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />
          ))}
        </div>
      ) : rows.length > 0 ? (
        <InvoiceTable rows={rows} showCustomer={false} basePath="/customer/invoices" />
      ) : (
        <Card>
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices for your subscription will appear here once they are issued."
          />
        </Card>
      )}
    </div>
  )
}
