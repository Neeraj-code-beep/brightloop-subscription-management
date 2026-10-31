import { useMemo } from 'react'
import useDiscounts from './useDiscounts.js'
import useInvoices from './useInvoices.js'
import useRole from './useRole.js'
import useStaff from './useStaff.js'
import useSubscriptions from './useSubscriptions.js'
import useTaxRules from './useTaxRules.js'
import { buildSearchIndex } from '../utils/globalSearch.js'

export default function useSearchIndex() {
  const { role, user } = useRole()
  const { subscriptions } = useSubscriptions()
  const { invoices, payments } = useInvoices()
  const { taxRules } = useTaxRules()
  const { discounts } = useDiscounts()
  const { staff } = useStaff()

  return useMemo(
    () => buildSearchIndex({ role, user, subscriptions, invoices, payments, taxRules, discounts, staff }),
    [role, user, subscriptions, invoices, payments, taxRules, discounts, staff],
  )
}
