import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { formatINR } from '../../utils/format.js'
import { getCustomerStatusLabel } from '../../utils/customerQueries.js'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function contactLine(summary) {
  return summary.email ?? summary.customer.contact
}

function planLine(summary) {
  const { subscription } = summary
  return subscription ? `${subscription.planName} · ${subscription.billingFrequency}` : '—'
}

export default function CustomerTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Customer</th>
              <th scope="col" className={headerCellClass}>Email / contact</th>
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Active subscription</th>
              <th scope="col" className={headerCellClass}>Plan</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Outstanding</th>
              <th scope="col" className={headerCellClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((summary) => (
              <tr key={summary.customer.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="max-w-[220px] px-4 py-3.5">
                  <Link
                    to={`/customers/${summary.customer.id}`}
                    className="block truncate font-medium text-primary hover:underline"
                  >
                    {summary.customer.name}
                  </Link>
                  <p className="text-xs text-foreground-subtle">{summary.customer.id}</p>
                </td>
                <td className="max-w-[240px] px-4 py-3.5">
                  <p className="truncate text-foreground">{contactLine(summary)}</p>
                  <p className="truncate text-xs text-foreground-subtle">{summary.customer.city}</p>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted lg:table-cell">
                  {summary.subscription?.id ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{planLine(summary)}</td>
                <td className="px-4 py-3.5 text-right">
                  <p className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                    {formatINR(summary.billing.outstanding)}
                  </p>
                  <p className="text-xs text-foreground-subtle">{summary.billing.openInvoices} open</p>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={getCustomerStatusLabel(summary)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((summary) => (
          <li key={summary.customer.id}>
            <Link
              to={`/customers/${summary.customer.id}`}
              className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-primary">{summary.customer.name}</span>
                  <StatusBadge status={getCustomerStatusLabel(summary)} />
                </div>
                <p className="truncate text-xs text-foreground-muted">{contactLine(summary)}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                  <span className="truncate">{planLine(summary)}</span>
                  <span className="shrink-0 tabular-nums">{summary.billing.openInvoices} open</span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatINR(summary.billing.outstanding)} outstanding
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
