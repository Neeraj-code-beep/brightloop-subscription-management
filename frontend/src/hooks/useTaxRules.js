import { useContext } from 'react'
import { TaxRulesContext } from '../context/TaxRulesContext.js'

export default function useTaxRules() {
  const context = useContext(TaxRulesContext)
  if (!context) {
    throw new Error('useTaxRules must be used within TaxRulesProvider')
  }
  return context
}
