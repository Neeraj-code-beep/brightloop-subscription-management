import { cn } from '../../utils/cn.js'

export default function StatStrip({ stats, ariaLabel = 'Summary', gridClassName = 'md:grid-cols-4' }) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm', gridClassName)}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface px-4 py-3.5 sm:px-5">
          <p className="text-xs font-medium text-foreground-subtle">{stat.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
            {stat.value}
          </p>
          {stat.helper && <p className="mt-0.5 text-xs text-foreground-muted">{stat.helper}</p>}
        </div>
      ))}
    </section>
  )
}
