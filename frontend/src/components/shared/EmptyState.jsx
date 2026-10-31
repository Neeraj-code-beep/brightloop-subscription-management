export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-text">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-foreground-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
