import Card from '../ui/Card.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const headerCellClass =
  'bg-surface-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle'

export default function TaxRulesTable({ rules }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={headerCellClass}>Tax rule</th>
              <th scope="col" className={`${headerCellClass} text-right`}>Rate</th>
              <th scope="col" className={headerCellClass}>Description</th>
              <th scope="col" className={headerCellClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id} className="transition-colors duration-150 hover:bg-surface-hover">
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-foreground">{rule.name}</p>
                  <p className="text-xs text-foreground-subtle">{rule.id}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {rule.rate}%
                </td>
                <td className="px-4 py-3.5 text-foreground-muted">{rule.description || '—'}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={rule.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rules.map((rule) => (
          <li key={rule.id} className="space-y-2 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{rule.name}</p>
                <p className="text-xs text-foreground-subtle">{rule.id}</p>
              </div>
              <StatusBadge status={rule.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold tabular-nums text-foreground">{rule.rate}%</span>
              <span className="text-xs text-foreground-muted">{rule.description || '—'}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
