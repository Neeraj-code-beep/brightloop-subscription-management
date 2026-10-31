import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../ui/StatusBadge.jsx'
import Card from '../ui/Card.jsx'
import { buttonVariants } from '../ui/buttonStyles.js'
import { formatDate, formatINR } from '../../utils/format.js'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

export default function InvoiceTable({ rows, showCustomer = true, basePath = '/invoices' }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Invoice</th>
              {showCustomer && <th scope="col" className={headerCellClass}>Customer</th>}
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Subscription</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Issue date</th>
              <th scope="col" className={headerCellClass}>Due date</th>
              <th scope="col" className={headerCellClass}>Status</th>
              <th scope="col" className={`${headerCellClass} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ invoice, customerName, total, status }) => (
              <tr key={invoice.number} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="whitespace-nowrap px-4 py-3.5">
                  <Link to={`${basePath}/${invoice.number}`} className="font-medium tabular-nums text-primary hover:underline">
                    {invoice.number}
                  </Link>
                </td>
                {showCustomer && (
                  <td className="max-w-[220px] px-4 py-3.5">
                    <p className="truncate font-medium text-foreground">{customerName}</p>
                  </td>
                )}
                <td className="hidden whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted lg:table-cell">
                  {invoice.subscriptionId}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatINR(total)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted lg:table-cell">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link to={`${basePath}/${invoice.number}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ invoice, customerName, total, status }) => (
          <li key={invoice.number}>
            <Link
              to={`${basePath}/${invoice.number}`}
              className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium tabular-nums text-primary">{invoice.number}</span>
                  <StatusBadge status={status} />
                </div>
                {showCustomer && <p className="truncate text-sm font-medium text-foreground">{customerName}</p>}
                <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                  <span>{invoice.subscriptionId}</span>
                  <span className="tabular-nums">Due {formatDate(invoice.dueDate)}</span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(total)}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
