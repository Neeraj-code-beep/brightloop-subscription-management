export default function FormField({ id, label, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-error-text">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-foreground-muted">{hint}</p>
      )}
    </div>
  )
}
