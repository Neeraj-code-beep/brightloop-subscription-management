import { cn } from '../../utils/cn.js'

const tones = {
  neutral: { badge: 'bg-neutral-soft text-neutral-text ring-border', dot: 'bg-neutral' },
  info: { badge: 'bg-primary-soft text-primary-soft-text ring-primary/20', dot: 'bg-primary' },
  success: { badge: 'bg-success-soft text-success-text ring-success/25', dot: 'bg-success' },
  warning: { badge: 'bg-warning-soft text-warning-text ring-warning/25', dot: 'bg-warning' },
  error: { badge: 'bg-error-soft text-error-text ring-error/25', dot: 'bg-error' },
}

const statusTones = {
  Draft: 'neutral',
  Quotation: 'warning',
  Confirmed: 'info',
  Active: 'success',
  Closed: 'neutral',
  Paused: 'warning',
  Paid: 'success',
  Overdue: 'error',
  Captured: 'success',
  Pending: 'warning',
  Failed: 'error',
  Scheduled: 'info',
  Expired: 'neutral',
  'Usage limit reached': 'warning',
}

export default function StatusBadge({ status, className }) {
  const tone = tones[statusTones[status] ?? 'neutral']

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      {status}
    </span>
  )
}
