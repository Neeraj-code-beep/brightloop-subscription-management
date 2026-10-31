import { useContext } from 'react'
import { InvoicesContext } from '../context/InvoicesContext.js'

export default function useInvoices() {
  const context = useContext(InvoicesContext)
  if (!context) {
    throw new Error('useInvoices must be used within InvoicesProvider')
  }
  return context
}
