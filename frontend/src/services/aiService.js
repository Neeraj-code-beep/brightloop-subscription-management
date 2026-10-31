import apiClient from './apiClient.js'
import { ROLES } from '../constants/roles.js'
import { AI_INTENTS } from './aiIntents.js'

const UNKNOWN_TEXT =
  'I can help with subscriptions, invoices, payments, customers and billing insights. Try asking about overdue invoices or outstanding payments.'
const RESTRICTED_CUSTOMER_TEXT =
  "I can help with your subscriptions, invoices and payments, but I can't access company-wide billing information."
const RESTRICTED_STAFF_TEXT = 'Revenue, MRR and plan reporting are available to admins only.'

const CUSTOMER_RESTRICTED_PATTERN =
  /\b(mrr|revenue|company|customers?|everyone|global|all invoices|all payments|all subscriptions|total collected|active subscriptions|other people)\b|\btell me about (?!me\b|my\b)/
const STAFF_RESTRICTED_PATTERN = /\b(mrr|revenue|recurring|plans?|products?|collected|income)\b/

export async function askBrightloopAI({ question, role, context = {}, conversationId }) {
  const normalized = (question || '').trim().toLowerCase()

  if (role === ROLES.CUSTOMER && CUSTOMER_RESTRICTED_PATTERN.test(normalized)) {
    return { status: 'restricted', text: RESTRICTED_CUSTOMER_TEXT, items: [] }
  }

  if (role === ROLES.STAFF && STAFF_RESTRICTED_PATTERN.test(normalized)) {
    return { status: 'restricted', text: RESTRICTED_STAFF_TEXT, items: [] }
  }

  // Attempt request via Backend AI Proxy Gateway
  try {
    const payload = {
      prompt: question,
      conversationId: conversationId || undefined,
      context: {
        currentCustomerId: context.currentCustomerId || context.customerId,
        role,
        ...context,
      },
    }

    const response = await apiClient.post('/ai/chat', payload)
    const resultData = response.data?.data

    if (resultData) {
      const text = resultData.reply || resultData.answer || resultData.response || resultData.text
      if (text) {
        return {
          status: 'ok',
          text,
          conversationId: resultData.conversationId || conversationId,
          items: resultData.items || [],
        }
      }
    }
  } catch (err) {
    const statusCode = err?.response?.status
    if (statusCode === 503) {
      return {
        status: 'error',
        text: 'The AI Billing Copilot service is temporarily unavailable (503 Service Unavailable). Please verify the upstream AI service or try again later.',
        items: [],
      }
    }
    if (statusCode === 402) {
      return {
        status: 'error',
        text: 'AI provider quota exceeded (402 Payment Required). Please top up credits or check provider subscription limits.',
        items: [],
      }
    }
    console.warn('AI gateway request failed, attempting local intent fallback:', err?.message)
  }

  // Graceful fallback to local intent processor if available
  const intent = AI_INTENTS.find((item) => item.roles.includes(role) && item.matches(normalized, context))
  if (intent) return intent.answer(context, normalized)

  return { status: 'unknown', text: UNKNOWN_TEXT, items: [] }
}
