import { Link } from 'react-router-dom'
import { formatDate, formatINR } from '../../utils/format.js'
import { buttonVariants } from '../ui/buttonStyles.js'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const headerCellClass = 'bg-surface-muted px-5 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

export default function RecentInvoicesTable({ title, description, invoices, viewAllTo }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-foreground-muted">{description}</p>
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            View all
          </Link>
        )}
      </div>

      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[42%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Customer</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
              <th scope="col" className={headerCellClass}>Due date</th>
              <th scope="col" className={headerCellClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="px-5 py-3.5">
                  <p className="truncate font-medium text-foreground">{invoice.customer}</p>
                  <p className="text-xs tabular-nums text-foreground-subtle">{invoice.id}</p>
                </td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatINR(invoice.amount)}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-foreground-muted">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="space-y-2 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{invoice.customer}</p>
                <p className="text-xs tabular-nums text-foreground-subtle">{invoice.id}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {formatINR(invoice.amount)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
              <span className="tabular-nums">Due {formatDate(invoice.dueDate)}</span>
              <StatusBadge status={invoice.status} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
