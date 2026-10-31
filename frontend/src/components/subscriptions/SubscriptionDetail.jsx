import Card from '../ui/Card.jsx'
import { TAX_RATE_PERCENT } from '../../constants/subscriptions.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { computeTotals, getLineAmount } from '../../utils/subscriptionMath.js'

function includedTax(amount) {
  return amount - Math.round(amount / (1 + TAX_RATE_PERCENT / 100))
}

function Field({ label, value }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function SummaryRow({ label, value, emphasis = false }) {
  return (
    <div className={emphasis ? 'flex items-center justify-between gap-4 border-t border-border pt-3' : 'flex items-center justify-between gap-4'}>
      <dt className={emphasis ? 'text-sm font-semibold text-foreground' : 'text-sm text-foreground-muted'}>{label}</dt>
      <dd className={emphasis ? 'text-base font-semibold tabular-nums text-foreground' : 'text-sm font-medium tabular-nums text-foreground'}>
        {value}
      </dd>
    </div>
  )
}

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

export default function SubscriptionDetail({ subscription, customerName, planName }) {
  const totals = computeTotals(subscription.lines, subscription.discountPercent)
  const renewalLabel = subscription.status === 'Closed' ? 'Closed' : subscription.autoRenew ? 'Auto-renews' : 'Manual renewal'

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground">Overview</h3>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer" value={customerName} />
          <Field label="Plan" value={planName} />
          <Field label="Billing" value={subscription.billingFrequency} />
          <Field label="Start date" value={formatDate(subscription.startDate)} />
          <Field label="Expiry date" value={formatDate(subscription.expiryDate)} />
          <Field
            label="Next billing"
            value={subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : '—'}
          />
          <Field label="Payment terms" value={subscription.paymentTerms} />
          <Field label="Renewal" value={renewalLabel} />
          <Field label="Created by" value={subscription.createdBy} />
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-foreground">Line items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className={headerCellClass}>Product</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Quantity</th>
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
                    <td className="px-4 py-3.5 font-medium text-foreground">{line.productName}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">{line.quantity}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">{formatINR(line.unitPrice)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">
                      {formatINR(includedTax(amount))}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-foreground">{formatINR(amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground">Billing summary</h3>
        <dl className="mt-4 max-w-sm space-y-3">
          <SummaryRow label="Subtotal" value={formatINR(totals.subtotal)} />
          <SummaryRow label="Discount" value={totals.discount > 0 ? `− ${formatINR(totals.discount)}` : formatINR(0)} />
          <SummaryRow label={`Tax (${TAX_RATE_PERCENT}% included)`} value={formatINR(totals.tax)} />
          <SummaryRow label="Total" value={formatINR(totals.total)} emphasis />
        </dl>
      </Card>
    </div>
  )
}
