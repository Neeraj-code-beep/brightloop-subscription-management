import { cn } from '../../utils/cn.js'

export default function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}
      {...props}
    />
  )
}
