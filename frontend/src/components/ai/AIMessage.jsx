import { Sparkles } from 'lucide-react'

export default function AIMessage({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-primary-soft px-3.5 py-2.5 text-sm text-foreground">
          {message.text}
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
        <Sparkles size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm leading-relaxed text-foreground">{message.text}</p>
        {message.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {message.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.primary}</p>
                  {item.secondary && <p className="truncate text-xs text-foreground-subtle">{item.secondary}</p>}
                </div>
                {item.value && (
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{item.value}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
