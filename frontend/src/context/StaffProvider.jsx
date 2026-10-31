import { useCallback, useMemo, useState } from 'react'
import { StaffContext } from './StaffContext.js'
import { INITIAL_STAFF } from '../data/staff.js'
import { ROLES } from '../constants/roles.js'
import useRole from '../hooks/useRole.js'
import { buildStaffRecord, validateStaffDraft } from '../services/staffService.js'

export default function StaffProvider({ children }) {
  const { role } = useRole()
  const [staff, setStaff] = useState(INITIAL_STAFF)

  const createStaff = useCallback(
    (draft) => {
      if (role !== ROLES.ADMIN) {
        throw new Error('Only Admins can add staff members.')
      }

      const errors = validateStaffDraft(draft, staff)
      if (Object.keys(errors).length > 0) return { errors }

      const member = buildStaffRecord(draft, staff)
      setStaff((previous) => [...previous, member])
      return { staff: member }
    },
    [staff, role],
  )

  const value = useMemo(() => ({ staff, createStaff }), [staff, createStaff])

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>
}
