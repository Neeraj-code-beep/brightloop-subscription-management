import { Link } from 'react-router-dom'
import { formatDate, formatINR } from '../../utils/format.js'
import UserAvatar from '../shared/UserAvatar.jsx'
import { buttonVariants } from '../ui/buttonStyles.js'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

export default function RecentPaymentsList({ title, description, payments, viewAllTo }) {
  return (
    <Card className="flex flex-col overflow-hidden">
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

      <ul className="divide-y divide-border">
        {payments.map((payment) => (
          <li
            key={payment.id}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:px-6"
          >
            <UserAvatar name={payment.customer} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">{payment.customer}</p>
              <p className="truncate text-xs text-foreground-subtle">
                {payment.method} &middot; {formatDate(payment.date)}
              </p>
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(payment.amount)}</p>
              <StatusBadge status={payment.status} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
