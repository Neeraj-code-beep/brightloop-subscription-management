import { Link } from 'react-router-dom'
import { BRIGHTLOOP_BILLING_NAME } from '../../constants/invoices.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { formatDiscountValue } from '../../utils/discountQueries.js'
import { computeInvoiceLines, daysBetween, getInvoicePricing, getInvoiceTotals } from '../../utils/invoiceMath.js'
import { REFERENCE_DATE } from '../../constants/subscriptions.js'
import StatusBadge from '../ui/StatusBadge.jsx'
import Card from '../ui/Card.jsx'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function Party({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function TotalRow({ label, detail, value, emphasis = false }) {
  return (
    <div
      className={
        emphasis
          ? 'flex items-center justify-between gap-4 border-t border-border pt-3'
          : 'flex items-center justify-between gap-4'
      }
    >
      <dt className={emphasis ? 'text-sm font-semibold text-foreground' : 'text-sm text-foreground-muted'}>
        {label}
        {detail && <span className="block text-xs text-foreground-subtle">{detail}</span>}
      </dt>
      <dd className={emphasis ? 'text-base font-semibold tabular-nums text-foreground' : 'text-sm font-medium tabular-nums text-foreground'}>
        {value}
      </dd>
    </div>
  )
}

function paymentDescription(invoice, status, payments, balance) {
  const latest = payments[0]
  const partial = payments.length > 0

  if (status === 'Paid' && latest) {
    return `Paid in full on ${formatDate(latest.date)} via ${latest.method}`
  }
  if (status === 'Overdue') {
    const overdue = `${daysBetween(invoice.dueDate, REFERENCE_DATE)} days overdue`
    return partial ? `${overdue}, ${formatINR(balance)} remaining` : overdue
  }
  if (status === 'Confirmed') {
    return partial
      ? `Partly paid, ${formatINR(balance)} remaining`
      : `Awaiting payment, due ${formatDate(invoice.dueDate)}`
  }
  return 'Not yet confirmed'
}

export default function InvoiceDocument({ invoice, customer, status, showSubscriptionLink, payments }) {
  const totals = getInvoiceTotals(invoice)
  const { lines, discountPercent, options } = getInvoicePricing(invoice)
  const lineRows = computeInvoiceLines(lines, discountPercent, options)
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const balance = totals.total - paidAmount

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 border-b border-border p-5 sm:grid-cols-2 sm:p-6">
        <Party label="From">
          <p className="font-semibold">{BRIGHTLOOP_BILLING_NAME}</p>
        </Party>
        <Party label="Bill to">
          <p className="font-semibold">{customer?.name ?? 'Unknown customer'}</p>
          {customer && (
            <p className="text-foreground-muted">
              {customer.contact}, {customer.city}
            </p>
          )}
        </Party>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className={headerCellClass}>Product / plan</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Qty</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Unit price</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Tax</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Discount</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lines.map((line, index) => {
              const lineTotals = lineRows[index]
              return (
                <tr key={line.productName}>
                  <td className="px-4 py-3.5 font-medium text-foreground">{line.productName}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">{line.quantity}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">{formatINR(line.unitPrice)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">{formatINR(lineTotals.tax)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-foreground-muted">
                    {lineTotals.subscriptionDiscount + lineTotals.ruleShare > 0
                      ? `− ${formatINR(lineTotals.subscriptionDiscount + lineTotals.ruleShare)}`
                      : formatINR(0)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-foreground">
                    {formatINR(lineTotals.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-8 border-t border-border p-5 sm:p-6 lg:grid-cols-2">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Issue date</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatDate(invoice.issueDate)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Due date</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatDate(invoice.dueDate)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Payment terms</dt>
            <dd className="font-medium text-foreground">{invoice.paymentTerms}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Payment status</dt>
            <dd className="space-y-2">
              <StatusBadge status={status} />
              <p className="text-foreground-muted">{paymentDescription(invoice, status, payments, balance)}</p>
            </dd>
          </div>
          {showSubscriptionLink && (
            <div className="col-span-2 space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Related subscription</dt>
              <dd>
                <Link
                  to={`/subscriptions/${invoice.subscriptionId}`}
                  className="font-medium text-primary hover:underline print:no-underline"
                >
                  {invoice.subscriptionId}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <dl className="ml-auto w-full max-w-sm space-y-3">
          <TotalRow label="Subtotal" value={formatINR(totals.subtotal)} />
          {(totals.discount > 0 || !invoice.discount) && (
            <TotalRow label="Discount" value={totals.discount > 0 ? `− ${formatINR(totals.discount)}` : formatINR(0)} />
          )}
          {invoice.discount && (
            <TotalRow
              label={`Discount (${invoice.discount.code})`}
              detail={`${invoice.discount.name} · ${formatDiscountValue(invoice.discount)}`}
              value={`− ${formatINR(invoice.discount.amount)}`}
            />
          )}
          {totals.taxRecord && <TotalRow label="Taxable subtotal" value={formatINR(totals.taxable)} />}
          {totals.taxRecord && (
            <TotalRow label={totals.taxRecord.name} detail="Included in price" value={formatINR(totals.tax)} />
          )}
          <TotalRow label="Total" value={formatINR(totals.total)} emphasis />
          {paidAmount > 0 && <TotalRow label="Amount paid" value={formatINR(paidAmount)} />}
          {paidAmount > 0 && <TotalRow label="Balance due" value={formatINR(balance)} />}
        </dl>
      </div>
    </Card>
  )
}
