import { PAYMENT_STATUS } from '../../constants/invoices.js'
import { formatDate, formatINR } from '../../utils/format.js'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

export default function InvoicePaymentHistory({ payments }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-foreground">Payment history</h2>
      </div>

      {payments.length === 0 ? (
        <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {payment.id} &middot; {payment.method}
                </p>
                <p className="text-xs text-foreground-subtle">
                  {formatDate(payment.date)}
                  {payment.reference && ` · ${payment.reference}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(payment.amount)}</p>
                <StatusBadge status={PAYMENT_STATUS} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
