import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

function ValidityCell({ row }) {
  return (
    <>
      <p className="whitespace-nowrap text-foreground">{row.validityLabel}</p>
      <p className="text-xs text-foreground-muted">{row.validityHint}</p>
    </>
  )
}

function StatusCell({ row }) {
  return (
    <div className="space-y-1">
      <StatusBadge status={row.status} />
      {row.expiringSoon && <p className="text-xs font-medium text-warning-text">Expiring soon</p>}
    </div>
  )
}

export default function DiscountTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Discount</th>
              <th scope="col" className={headerCellClass}>Type</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Value</th>
              <th scope="col" className={headerCellClass}>Applies to</th>
              <th scope="col" className={headerCellClass}>Validity</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Usage</th>
              <th scope="col" className={headerCellClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.discount.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="max-w-[240px] px-4 py-3.5">
                  <p className="truncate font-semibold tracking-wide text-foreground">{row.discount.code}</p>
                  <p className="truncate text-xs text-foreground-subtle">{row.discount.name}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-foreground-muted">{row.discount.type}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {row.valueLabel}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3.5 text-foreground-muted">{row.appliesToLabel}</td>
                <td className="px-4 py-3.5">
                  <ValidityCell row={row} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-foreground">{row.usageLabel}</td>
                <td className="px-4 py-3.5">
                  <StatusCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.discount.id} className="flex items-start gap-3 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-wide text-foreground">{row.discount.code}</p>
                  <p className="truncate text-xs text-foreground-subtle">{row.discount.name}</p>
                </div>
                <StatusCell row={row} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold tabular-nums text-foreground">
                  {row.valueLabel} off
                </span>
                <span className="text-xs text-foreground-muted">{row.appliesToLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground-muted">{row.validityLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-foreground-subtle">
                <span>{row.validityHint}</span>
                <span className="tabular-nums">Used {row.usageLabel}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
