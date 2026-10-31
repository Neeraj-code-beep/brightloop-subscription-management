import { cn } from '../../utils/cn.js'

export default function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted disabled:text-foreground-subtle',
        className,
      )}
      {...props}
    />
  )
}
