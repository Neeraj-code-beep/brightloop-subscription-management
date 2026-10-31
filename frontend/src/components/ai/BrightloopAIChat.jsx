import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AI_SUBTITLES, AI_SUGGESTED_PROMPTS } from '../../constants/aiPrompts.js'
import useAIConversation from '../../hooks/useAIConversation.js'
import useRole from '../../hooks/useRole.js'
import { cn } from '../../utils/cn.js'
import { buttonVariants } from '../ui/buttonStyles.js'
import AIMessage from './AIMessage.jsx'
import AISuggestedPrompt from './AISuggestedPrompt.jsx'

export default function BrightloopAIChat({ onClose }) {
  const { role } = useRole()
  const { messages, pending, ask } = useAIConversation()
  const [draft, setDraft] = useState('')
  const bodyRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages.length, pending])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    function handlePointerDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [onClose])

  function submitQuestion(text) {
    setDraft('')
    ask(text)
  }

  function handleSubmit(event) {
    event.preventDefault()
    submitQuestion(draft)
  }

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Brightloop AI"
      className="fixed inset-x-3 bottom-3 z-50 flex h-[min(36rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(36rem,calc(100dvh-3rem))] sm:w-96"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Brightloop AI</p>
            <p className="truncate text-xs text-foreground-muted">{AI_SUBTITLES[role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Brightloop AI"
          className="shrink-0 rounded-lg p-1.5 text-foreground-subtle transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground-muted">
              Ask about subscriptions, invoices, payments and outstanding balances. Answers come from Brightloop&apos;s
              current billing data.
            </p>
            <div className="space-y-2">
              {AI_SUGGESTED_PROMPTS[role].map((prompt) => (
                <AISuggestedPrompt key={prompt} prompt={prompt} onSelect={submitQuestion} disabled={pending} />
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => <AIMessage key={message.id} message={message} />)
        )}

        {pending && (
          <p className="flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Checking your billing data...
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-muted p-3">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a billing question"
          aria-label="Ask Brightloop AI a question"
          maxLength={300}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          aria-label="Send question"
          className={cn(buttonVariants({ variant: 'primary' }), 'shrink-0 px-3')}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
