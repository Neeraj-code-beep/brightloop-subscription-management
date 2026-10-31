import { DEMO_USERS } from './users.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'

export const INITIAL_STAFF = [
  {
    id: 'STF-001',
    name: DEMO_USERS.admin.name,
    email: DEMO_USERS.admin.email,
    role: 'Admin',
    status: 'Active',
    addedOn: REFERENCE_DATE,
  },
  {
    id: 'STF-002',
    name: DEMO_USERS.staff.name,
    email: DEMO_USERS.staff.email,
    role: 'Staff',
    status: 'Active',
    addedOn: REFERENCE_DATE,
  },
]
