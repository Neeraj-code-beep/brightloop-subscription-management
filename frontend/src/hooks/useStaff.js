import { useContext } from 'react'
import { StaffContext } from '../context/StaffContext.js'

export default function useStaff() {
  const context = useContext(StaffContext)
  if (!context) {
    throw new Error('useStaff must be used within a StaffProvider')
  }
  return context
}
