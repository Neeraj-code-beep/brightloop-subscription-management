import { useMemo } from 'react'
import useInvoices from './useInvoices.js'
import useRole from './useRole.js'
import useSubscriptions from './useSubscriptions.js'
import { buildAIContext } from '../utils/aiContext.js'

export default function useAIContext() {
  const { role, user } = useRole()
  const { subscriptions } = useSubscriptions()
  const { invoices, payments } = useInvoices()

  return useMemo(
    () => buildAIContext({ role, user, subscriptions, invoices, payments }),
    [role, user, subscriptions, invoices, payments],
  )
}
