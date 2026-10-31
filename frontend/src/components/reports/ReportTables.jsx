import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatINR } from '../../utils/format.js'
import EmptyState from '../shared/EmptyState.jsx'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const cellClass = 'px-4 py-3 text-sm'
const headClass = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle'

function ReportTableCard({ title, description, children, isEmpty, emptyTitle, emptyDescription, columns }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
      {isEmpty ? (
        <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-muted">
              <tr>
                {columns.map((column) => (
                  <th key={column.label} scope="col" className={`${headClass} ${column.align === 'right' ? 'text-right' : ''}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">{children}</tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function OpenInvoicesTable({ rows }) {
  return (
    <ReportTableCard
      title="Open invoices"
      description="Confirmed and overdue invoices with a balance still due"
      isEmpty={rows.length === 0}
      emptyTitle="No open invoices"
      emptyDescription="Every invoice matching these filters is settled."
      columns={[
        { label: 'Invoice' },
        { label: 'Customer' },
        { label: 'Status' },
        { label: 'Balance', align: 'right' },
      ]}
    >
      {rows.map((row) => (
        <tr key={row.invoice.number} className="transition-colors hover:bg-surface-muted">
          <td className={cellClass}>
            <Link to={`/invoices/${row.invoice.number}`} className="font-medium text-primary hover:underline">
              {row.invoice.number}
            </Link>
          </td>
          <td className={cellClass}>
            <Link to={`/customers/${row.invoice.customerId}`} className="text-foreground hover:text-primary">
              {row.customerName}
            </Link>
          </td>
          <td className={cellClass}>
            <StatusBadge status={row.status} />
          </td>
          <td className={`${cellClass} text-right font-medium tabular-nums text-foreground`}>{formatINR(row.balance)}</td>
        </tr>
      ))}
    </ReportTableCard>
  )
}

export function RecentPaymentsTable({ rows }) {
  return (
    <ReportTableCard
      title="Recent payments"
      description="Latest receipts matching these filters"
      isEmpty={rows.length === 0}
      emptyTitle="No payments in this period"
      emptyDescription="Try a wider period or a different payment method."
      columns={[
        { label: 'Payment' },
        { label: 'Customer' },
        { label: 'Method' },
        { label: 'Amount', align: 'right' },
      ]}
    >
      {rows.map(({ payment, customerName }) => (
        <tr key={payment.id} className="transition-colors hover:bg-surface-muted">
          <td className={cellClass}>
            <span className="font-medium text-foreground">{payment.id}</span>
            <span className="block text-xs text-foreground-subtle">{payment.date}</span>
          </td>
          <td className={cellClass}>
            <Link to={`/customers/${payment.customerId}`} className="text-foreground hover:text-primary">
              {customerName}
            </Link>
          </td>
          <td className={`${cellClass} text-foreground-muted`}>{payment.method}</td>
          <td className={`${cellClass} text-right font-medium tabular-nums text-foreground`}>
            {formatINR(payment.amount)}
          </td>
        </tr>
      ))}
    </ReportTableCard>
  )
}

export function RevenueByProductTable({ rows }) {
  return (
    <ReportTableCard
      title="Revenue by product"
      description="Billed amount allocated to each product by its share of invoice lines"
      isEmpty={rows.length === 0}
      emptyTitle="No product revenue yet"
      emptyDescription="Billed invoices for these filters will appear here."
      columns={[{ label: 'Product' }, { label: 'Revenue', align: 'right' }]}
    >
      {rows.map((row) => (
        <tr key={row.productName} className="transition-colors hover:bg-surface-muted">
          <td className={`${cellClass} text-foreground`}>{row.productName}</td>
          <td className={`${cellClass} text-right font-medium tabular-nums text-foreground`}>{formatINR(row.amount)}</td>
        </tr>
      ))}
    </ReportTableCard>
  )
}
