import { CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const AUTO_DISMISS_MS = 6000

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">{toast.title}</p>
        {toast.description && <p className="text-sm text-foreground-muted">{toast.description}</p>}
        {toast.action && (
          <Link
            to={toast.action.to}
            onClick={() => onDismiss(toast.id)}
            className="inline-block pt-1 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {toast.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 shrink-0 rounded-md p-1 text-foreground-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col gap-3 sm:inset-x-auto sm:left-1/2 sm:top-auto sm:bottom-6 sm:w-96 sm:-translate-x-1/2',
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
