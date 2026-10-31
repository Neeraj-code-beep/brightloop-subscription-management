import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { formatINR } from '../../utils/format.js'
import { getOfferAvailability } from '../../utils/productsPlansQueries.js'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function detailPath(offer) {
  return `/products-plans/${offer.id}`
}

export default function ProductsPlansTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Product / Plan</th>
              <th scope="col" className={headerCellClass}>Type</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Price</th>
              <th scope="col" className={headerCellClass}>Billing frequency</th>
              <th scope="col" className={headerCellClass}>Status</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Active subscriptions</th>
              <th scope="col" className={headerCellClass}>Availability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ offer, activeSubscriptions }) => (
              <tr key={offer.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="max-w-[260px] px-4 py-3.5">
                  <Link to={detailPath(offer)} className="block truncate font-medium text-primary hover:underline">
                    {offer.planName}
                  </Link>
                  <p className="truncate text-xs text-foreground-subtle">{offer.productName}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{offer.type}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatINR(offer.salesPrice)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{offer.billingFrequency}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={offer.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-foreground">{activeSubscriptions}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{getOfferAvailability(offer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ offer, activeSubscriptions }) => (
          <li key={offer.id}>
            <Link
              to={detailPath(offer)}
              className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-primary">{offer.planName}</span>
                  <StatusBadge status={offer.status} />
                </div>
                <p className="truncate text-xs text-foreground-muted">
                  {offer.productName} · {offer.type}
                </p>
                <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                  <span>{offer.billingFrequency}</span>
                  <span className="tabular-nums">
                    {activeSubscriptions} active · {getOfferAvailability(offer)}
                  </span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(offer.salesPrice)}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
