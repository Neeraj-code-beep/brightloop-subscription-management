import { Check } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { formatDate } from '../../utils/format.js'
import Card from '../ui/Card.jsx'

const LIFECYCLE_STAGES = ['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed']

function stageState(stage, currentStatus) {
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStatus)
  const stageIndex = LIFECYCLE_STAGES.indexOf(stage)
  if (stageIndex < currentIndex) return 'complete'
  if (stageIndex === currentIndex) return 'current'
  return 'upcoming'
}

const dotClass = {
  complete: 'border-primary bg-primary text-primary-on',
  current: 'border-primary bg-surface text-primary ring-4 ring-primary-soft',
  upcoming: 'border-border bg-surface text-foreground-subtle',
}

const labelClass = {
  complete: 'text-foreground',
  current: 'text-primary-soft-text',
  upcoming: 'text-foreground-subtle',
}

export default function SubscriptionLifecycle({ status, activity }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground">Lifecycle</h3>
        <ol className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-2" aria-label="Subscription lifecycle">
          {LIFECYCLE_STAGES.map((stage) => {
            const state = stageState(stage, status)
            return (
              <li
                key={stage}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                    dotClass[state],
                  )}
                >
                  {state === 'complete' ? <Check size={14} aria-hidden="true" /> : LIFECYCLE_STAGES.indexOf(stage) + 1}
                </span>
                <span className={cn('text-sm font-medium', labelClass[state])}>
                  {stage}
                  {state === 'current' && <span className="sr-only"> (current stage)</span>}
                </span>
              </li>
            )
          })}
        </ol>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        {activity.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm text-foreground">{item.label}</p>
                  <p className="text-xs tabular-nums text-foreground-subtle">{formatDate(item.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-muted">No activity recorded yet.</p>
        )}
      </Card>
    </div>
  )
}
