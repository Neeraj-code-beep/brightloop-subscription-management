import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import useRole from '../../hooks/useRole.js'
import { cn } from '../../utils/cn.js'
import { buttonVariants } from '../ui/buttonStyles.js'
import BrightloopAIChat from './BrightloopAIChat.jsx'

export default function BrightloopAIFloatingButton() {
  const { role } = useRole()
  const [open, setOpen] = useState(false)

  if (open) return <BrightloopAIChat key={role} onClose={() => setOpen(false)} />

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Ask Brightloop AI"
      className={cn(
        buttonVariants({ variant: 'primary' }),
        'fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full p-0 shadow-lg sm:bottom-6 sm:right-6 sm:h-10 sm:w-auto sm:gap-2 sm:px-4',
      )}
    >
      <Sparkles size={18} aria-hidden="true" />
      <span className="hidden sm:inline">Ask Brightloop AI</span>
    </button>
  )
}
