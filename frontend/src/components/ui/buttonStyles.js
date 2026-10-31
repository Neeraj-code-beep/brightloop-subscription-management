const variants = {
  primary: 'bg-primary text-primary-on shadow-sm hover:bg-primary-hover',
  secondary:
    'bg-surface text-foreground border border-border shadow-sm hover:bg-surface-hover',
  ghost: 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
}

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export function buttonVariants({ variant = 'primary', size = 'md', className } = {}) {
  return [
    'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
