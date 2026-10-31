import apiClient from './apiClient.js'
import { ROLES } from '../constants/roles.js'

const RESTRICTED_CUSTOMER_TEXT =
  "I can help with your subscriptions, invoices and payments, but I cannot access company-wide billing information or other customers' records."
const RESTRICTED_STAFF_TEXT = 'Revenue, MRR, ARR, and executive reporting are available to administrators only.'

const CUSTOMER_RESTRICTED_PATTERN =
  /\b(mrr|revenue|company|customers?|everyone|global|all invoices|all payments|all subscriptions|total collected|active subscriptions|other people)\b|\btell me about (?!me\b|my\b)/
const STAFF_RESTRICTED_PATTERN = /\b(mrr|revenue|recurring|plans?|products?|collected|income)\b/

export async function askBrightloopAI({ question, role, context = {}, conversationId }) {
  const normalized = (question || '').trim().toLowerCase()

  // Guard against role-level data leakage
  if (role === ROLES.CUSTOMER && CUSTOMER_RESTRICTED_PATTERN.test(normalized)) {
    return { status: 'restricted', text: RESTRICTED_CUSTOMER_TEXT, items: [] }
  }

  if (role === ROLES.STAFF && STAFF_RESTRICTED_PATTERN.test(normalized)) {
    return { status: 'restricted', text: RESTRICTED_STAFF_TEXT, items: [] }
  }

  // Strictly enforce customer context isolation: customers can only send their own customerId
  const isolatedCustomerId = role === ROLES.CUSTOMER ? context.currentCustomerId || context.customerId : context.currentCustomerId

  try {
    const payload = {
      prompt: question,
      conversationId: conversationId || undefined,
      context: {
        currentCustomerId: isolatedCustomerId,
        role,
      },
    }

    const response = await apiClient.post('/ai/chat', payload)
    const resultData = response.data?.data

    if (resultData) {
      // Support both data.reply and data.answer as specified in project contract
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

    return {
      status: 'error',
      text: 'Received an empty response from AI Billing Copilot.',
      items: [],
    }
  } catch (err) {
    const statusCode = err?.response?.status

    if (statusCode === 503) {
      return {
        status: 'error',
        text: 'The AI Billing Copilot service is temporarily unavailable (503 Service Unavailable). Please verify that the AI service is running.',
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

    if (err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout')) {
      return {
        status: 'error',
        text: 'AI service request timed out. Please try again shortly.',
        items: [],
      }
    }

    const errorMessage =
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      'Unable to connect to AI Billing Copilot. Please try again.'

    return {
      status: 'error',
      text: errorMessage,
      items: [],
    }
  }
}

export default askBrightloopAI;
