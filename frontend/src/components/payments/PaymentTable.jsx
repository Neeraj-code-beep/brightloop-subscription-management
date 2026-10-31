import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PAYMENT_STATUS } from '../../constants/invoices.js'
import { formatDate, formatINR } from '../../utils/format.js'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

export default function PaymentTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Payment</th>
              <th scope="col" className={headerCellClass}>Customer</th>
              <th scope="col" className={headerCellClass}>Invoice</th>
              <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>Method</th>
              <th scope="col" className={headerCellClass}>Date</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
              <th scope="col" className={headerCellClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ payment, customerName }) => (
              <tr key={payment.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="whitespace-nowrap px-4 py-3.5 font-medium tabular-nums text-foreground">{payment.id}</td>
                <td className="max-w-[220px] px-4 py-3.5">
                  <p className="truncate font-medium text-foreground">{customerName}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <Link
                    to={`/invoices/${payment.invoiceNumber}`}
                    className="font-medium tabular-nums text-primary hover:underline"
                  >
                    {payment.invoiceNumber}
                  </Link>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3.5 text-foreground-muted lg:table-cell">{payment.method}</td>
                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-foreground-muted">{formatDate(payment.date)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatINR(payment.amount)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={PAYMENT_STATUS} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ payment, customerName }) => (
          <li key={payment.id}>
            <Link
              to={`/invoices/${payment.invoiceNumber}`}
              className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium tabular-nums text-foreground">{payment.id}</span>
                  <StatusBadge status={PAYMENT_STATUS} />
                </div>
                <p className="truncate text-sm font-medium text-foreground">{customerName}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                  <span className="tabular-nums">{payment.invoiceNumber}</span>
                  <span className="tabular-nums">{formatDate(payment.date)}</span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(payment.amount)}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
