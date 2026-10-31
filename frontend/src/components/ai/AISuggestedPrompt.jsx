export default function AISuggestedPrompt({ prompt, onSelect, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt)}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {prompt}
    </button>
  )
}
