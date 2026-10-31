import { useContext } from 'react'
import { DiscountsContext } from '../context/DiscountsContext.js'

export default function useDiscounts() {
  const context = useContext(DiscountsContext)
  if (!context) {
    throw new Error('useDiscounts must be used within DiscountsProvider')
  }
  return context
}
