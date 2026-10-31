import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { TaxRulesContext } from './TaxRulesContext.js'
import { INITIAL_TAX_RULES } from '../data/taxRules.js'
import { ROLES } from '../constants/roles.js'
import useRole from '../hooks/useRole.js'
import { buildTaxRuleRecord, validateTaxRuleDraft, taxApi } from '../services/taxService.js'

export default function TaxRulesProvider({ children }) {
  const { role } = useRole()
  const [taxRules, setTaxRules] = useState(INITIAL_TAX_RULES)

  const loadTaxes = useCallback(async () => {
    try {
      const res = await taxApi.getTaxes({ limit: 100 })
      const list = Array.isArray(res) ? res : res?.taxes || []
      if (list.length > 0) {
        const mapped = list.map((t) => ({
          id: t.id,
          name: t.name,
          rate: Number(t.rate || 0),
          description: t.description || '',
          status: t.isActive !== false ? 'Active' : 'Archived',
        }))
        setTaxRules(mapped)
      }
    } catch (err) {
      console.warn('Failed to load live tax rules:', err)
    }
  }, [])

  useEffect(() => {
    loadTaxes()
  }, [loadTaxes])

  const createTaxRule = useCallback(
    async (draft) => {
      if (role !== ROLES.ADMIN) {
        throw new Error('Only Admins can create tax rules.')
      }

      const errors = validateTaxRuleDraft(draft, taxRules)
      if (Object.keys(errors).length > 0) return { errors }

      const taxRule = buildTaxRuleRecord(draft, taxRules)
      setTaxRules((previous) => [...previous, taxRule])

      // Attempt backend persistence
      try {
        await taxApi.createTax({
          name: draft.name.trim(),
          rate: Number(draft.rate),
          description: draft.description?.trim() || '',
          isActive: draft.status === 'Active',
        })
      } catch (err) {
        console.warn('Backend tax creation error:', err)
      }

      return { taxRule }
    },
    [taxRules, role],
  )

  const value = useMemo(() => ({ taxRules, createTaxRule, refreshTaxes: loadTaxes }), [taxRules, createTaxRule, loadTaxes])

  return <TaxRulesContext.Provider value={value}>{children}</TaxRulesContext.Provider>
}
