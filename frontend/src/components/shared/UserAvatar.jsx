import { cn } from '../../utils/cn.js'

export default function UserAvatar({ name, className }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-text',
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
