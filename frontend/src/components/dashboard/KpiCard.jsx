import { cn } from '../../utils/cn.js'
import Card from '../ui/Card.jsx'
import { Calendar, Clock, FileWarning, Repeat, TrendingUp, Wallet, ArrowUpRight } from 'lucide-react'

const icons = {
  'active-subscriptions': Repeat,
  mrr: Wallet,
  outstanding: Clock,
  'overdue-invoices': FileWarning,
  'current-plan': Repeat,
  'next-payment': Calendar,
  'paid-this-year': Wallet,
}

const toneClasses = {
  primary: 'bg-primary-soft text-primary-soft-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  error: 'bg-error-soft text-error-text',
}

export default function KpiCard({ id, label, value, helper, tone, trend }) {
  const Icon = icons[id] ?? ArrowUpRight

  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground-muted">{label}</p>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            toneClasses[tone],
          )}
        >
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>

      <p className="truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-3xl">
        {value}
      </p>

      <p className="flex items-center gap-1.5 text-xs leading-snug text-foreground-subtle">
        {trend === 'up' && <TrendingUp size={14} className="shrink-0 text-success" aria-hidden="true" />}
        <span>{helper}</span>
      </p>
    </Card>
  )
}
