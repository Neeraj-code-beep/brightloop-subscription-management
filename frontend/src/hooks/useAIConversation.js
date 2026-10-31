import { useContext } from 'react'
import { AIConversationContext } from '../context/AIConversationContext.js'

export default function useAIConversation() {
  const context = useContext(AIConversationContext)
  if (!context) {
    throw new Error('useAIConversation must be used within AIConversationProvider')
  }
  return context
}
