import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { computeTotals } from '../../utils/subscriptionMath.js'
import { formatDate, formatINR } from '../../utils/format.js'
import Card from '../ui/Card.jsx'
import { buttonVariants } from '../ui/buttonStyles.js'
import SubscriptionStatusBadge from './SubscriptionStatusBadge.jsx'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function nextBillingLabel(subscription) {
  return subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : '—'
}

export default function SubscriptionTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Subscription</th>
              <th scope="col" className={headerCellClass}>Customer</th>
              <th scope="col" className={headerCellClass}>Plan</th>
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Billing</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Next billing</th>
              <th scope="col" className={headerCellClass}>Status</th>
              <th scope="col" className={`${headerCellClass} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ subscription, customerName, planName }) => (
              <tr key={subscription.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="whitespace-nowrap px-4 py-3.5">
                  <Link
                    to={`/subscriptions/${subscription.id}`}
                    className="font-medium tabular-nums text-primary hover:underline"
                  >
                    {subscription.id}
                  </Link>
                </td>
                <td className="max-w-[200px] px-4 py-3.5">
                  <p className="truncate font-medium text-foreground">{customerName}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{planName}</td>
                <td className="hidden whitespace-nowrap px-4 py-3.5 text-foreground-muted lg:table-cell">
                  {subscription.billingFrequency}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatINR(computeTotals(subscription.lines, subscription.discountPercent).total)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted lg:table-cell">
                  {nextBillingLabel(subscription)}
                </td>
                <td className="px-4 py-3.5">
                  <SubscriptionStatusBadge status={subscription.status} paused={subscription.paused} />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    to={`/subscriptions/${subscription.id}`}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ subscription, customerName, planName }) => (
          <li key={subscription.id}>
            <Link
              to={`/subscriptions/${subscription.id}`}
              className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium tabular-nums text-primary">{subscription.id}</span>
                  <SubscriptionStatusBadge status={subscription.status} paused={subscription.paused} />
                </div>
                <p className="truncate text-sm font-medium text-foreground">{customerName}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                  <span>
                    {planName} · {subscription.billingFrequency}
                  </span>
                  <span className="tabular-nums">Next {nextBillingLabel(subscription)}</span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatINR(computeTotals(subscription.lines, subscription.discountPercent).total)}
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
