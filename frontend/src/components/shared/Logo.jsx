import { Repeat } from 'lucide-react'
import { APP_NAME } from '../../constants/app.js'
import { cn } from '../../utils/cn.js'

export default function Logo({ className = '', iconOnlyOnDesktop = false }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-on">
        <Repeat size={18} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'text-base font-semibold tracking-tight text-foreground',
          iconOnlyOnDesktop && 'lg:hidden',
        )}
      >
        {APP_NAME}
      </span>
    </div>
  )
}
