import Card from '../ui/Card.jsx'
import SubscriptionStatusBadge from './SubscriptionStatusBadge.jsx'
import { TAX_RATE_PERCENT } from '../../constants/subscriptions.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { computeTotals, getLineAmount } from '../../utils/subscriptionMath.js'

const COMPANY_NAME = 'Brightloop Software'

const headerCellClass =
  'bg-surface-muted px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function includedTax(amount) {
  return amount - Math.round(amount / (1 + TAX_RATE_PERCENT / 100))
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function TotalRow({ label, value, emphasis = false }) {
  return (
    <div
      className={
        emphasis
          ? 'flex items-center justify-between gap-4 border-t border-border pt-3'
          : 'flex items-center justify-between gap-4'
      }
    >
      <dt className={emphasis ? 'text-sm font-semibold text-foreground' : 'text-sm text-foreground-muted'}>{label}</dt>
      <dd className={emphasis ? 'text-base font-semibold tabular-nums text-foreground' : 'text-sm font-medium tabular-nums text-foreground'}>
        {value}
      </dd>
    </div>
  )
}

export default function SubscriptionQuotation({ subscription, customer, planName }) {
  const totals = computeTotals(subscription.lines, subscription.discountPercent)

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{COMPANY_NAME}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">Quotation</p>
            <p className="text-sm tabular-nums text-foreground-muted">{subscription.quotationNumber}</p>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-sm tabular-nums text-foreground-muted">Date {formatDate(subscription.quotedOn)}</p>
            <SubscriptionStatusBadge status={subscription.status} paused={subscription.paused} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 py-5 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Prepared for</p>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{customer.name}</p>
              <p className="text-sm text-foreground-muted">Customer ID {customer.id}</p>
              <p className="text-sm text-foreground-muted">Contact {customer.contact}</p>
              <p className="text-sm text-foreground-muted">{customer.city}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Subscription" value={subscription.id} />
            <Detail label="Plan" value={planName} />
            <Detail label="Start date" value={formatDate(subscription.startDate)} />
            <Detail label="Expiry date" value={formatDate(subscription.expiryDate)} />
            <Detail label="Billing" value={subscription.billingFrequency} />
            <Detail label="Payment terms" value={subscription.paymentTerms} />
          </dl>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className={headerCellClass}>Product</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Qty</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Unit price</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Tax</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscription.lines.map((line) => {
                const amount = getLineAmount(line)
                return (
                  <tr key={line.productName}>
                    <td className="px-3 py-3 font-medium text-foreground">{line.productName}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground-muted">{line.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground-muted">{formatINR(line.unitPrice)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground-muted">{formatINR(includedTax(amount))}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-foreground">{formatINR(amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <dl className="space-y-3 border-t border-border p-5 sm:ml-auto sm:w-80">
          <TotalRow label="Subtotal" value={formatINR(totals.subtotal)} />
          <TotalRow label="Subscription discount" value={totals.discount > 0 ? `− ${formatINR(totals.discount)}` : formatINR(0)} />
          <TotalRow label={`Tax (${TAX_RATE_PERCENT}% included)`} value={formatINR(totals.tax)} />
          <TotalRow label="Total" value={formatINR(totals.total)} emphasis />
        </dl>
      </Card>
    </div>
  )
}
