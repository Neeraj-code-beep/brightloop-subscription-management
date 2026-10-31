import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AIConversationContext } from './AIConversationContext.js'
import useAIContext from '../hooks/useAIContext.js'
import useRole from '../hooks/useRole.js'
import { askBrightloopAI } from '../services/aiService.js'

const FALLBACK_TEXT = 'Something went wrong while looking that up. Please try again.'

export default function AIConversationProvider({ children }) {
  const { role } = useRole()
  const billingContext = useAIContext()
  const [conversation, setConversation] = useState({ role, messages: [], nextId: 0 })
  const [pending, setPending] = useState(false)
  const roleRef = useRef(role)

  useEffect(() => {
    roleRef.current = role
  }, [role])

  const appendMessages = useCallback((ownerRole, incoming) => {
    setConversation((previous) => {
      const base = previous.role === ownerRole ? previous : { role: ownerRole, messages: [], nextId: 0 }
      const numbered = incoming.map((message, index) => ({ ...message, id: base.nextId + index }))
      return {
        role: ownerRole,
        messages: [...base.messages, ...numbered],
        nextId: base.nextId + incoming.length,
      }
    })
  }, [])

  const ask = useCallback(
    async (text) => {
      const question = text.trim()
      if (!question || pending) return

      const askedRole = role
      setPending(true)
      appendMessages(askedRole, [{ role: 'user', text: question, items: [] }])

      let reply
      try {
        const response = await askBrightloopAI({ question, role: askedRole, context: billingContext })
        reply = { role: 'assistant', ...response }
      } catch {
        reply = { role: 'assistant', status: 'error', text: FALLBACK_TEXT, items: [] }
      }

      if (roleRef.current === askedRole) appendMessages(askedRole, [reply])
      setPending(false)
    },
    [appendMessages, billingContext, pending, role],
  )

  const value = useMemo(
    () => ({
      messages: conversation.role === role ? conversation.messages : [],
      pending,
      ask,
    }),
    [conversation, role, pending, ask],
  )

  return <AIConversationContext.Provider value={value}>{children}</AIConversationContext.Provider>
}
