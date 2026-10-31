import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DiscountsContext } from './DiscountsContext.js'
import { DISCOUNTS } from '../data/discounts.js'
import { ROLES } from '../constants/roles.js'
import useRole from '../hooks/useRole.js'
import { applyDiscountUsage, buildDiscountRecord, validateDiscountDraft, discountApi } from '../services/discountService.js'

export default function DiscountsProvider({ children }) {
  const { role } = useRole()
  const [discounts, setDiscounts] = useState(DISCOUNTS)

  const loadDiscounts = useCallback(async () => {
    try {
      const res = await discountApi.getDiscounts({ limit: 100 })
      const list = Array.isArray(res) ? res : res?.discounts || []
      if (list.length > 0) {
        const mapped = list.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          type: d.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed',
          value: Number(d.value || 0),
          appliesTo: d.appliesTo || 'All Products & Plans',
          status: d.isActive !== false ? 'Active' : 'Archived',
          usageCount: d.usageCount || 0,
          usageLimit: d.usageLimit,
          startDate: d.startDate,
          endDate: d.endDate,
        }))
        setDiscounts(mapped)
      }
    } catch (err) {
      console.warn('Failed to load live discounts:', err)
    }
  }, [])

  useEffect(() => {
    loadDiscounts()
  }, [loadDiscounts])

  const createDiscount = useCallback(
    async (draft) => {
      if (role !== ROLES.ADMIN) {
        throw new Error('Only Admins can create discounts.')
      }

      const errors = validateDiscountDraft(draft, discounts)
      if (Object.keys(errors).length > 0) return { errors }

      const discount = buildDiscountRecord(draft, discounts)
      setDiscounts((previous) => [...previous, discount])

      // Attempt backend persistence
      try {
        await discountApi.createDiscount({
          name: draft.name.trim(),
          code: draft.code.trim().toUpperCase(),
          type: draft.type === 'Percentage' ? 'PERCENTAGE' : 'FIXED',
          value: Number(draft.value),
          usageLimit: draft.usageLimit ? Number(draft.usageLimit) : undefined,
          isActive: true,
        })
      } catch (err) {
        console.warn('Backend discount creation error:', err)
      }

      return { discount }
    },
    [discounts, role],
  )

  const recordDiscountUse = useCallback((discountId) => {
    setDiscounts((previous) => applyDiscountUsage(previous, discountId))
  }, [])

  const value = useMemo(
    () => ({ discounts, createDiscount, recordDiscountUse, refreshDiscounts: loadDiscounts }),
    [discounts, createDiscount, recordDiscountUse, loadDiscounts],
  )

  return <DiscountsContext.Provider value={value}>{children}</DiscountsContext.Provider>
}
