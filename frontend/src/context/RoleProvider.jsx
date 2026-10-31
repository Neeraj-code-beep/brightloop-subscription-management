import { useMemo } from 'react'
import { DEMO_USERS } from '../data/users.js'
import { DEFAULT_ROLE, ROLE_DEFINITIONS } from '../constants/roles.js'
import { RoleContext } from './RoleContext.js'
import useAuth from '../hooks/useAuth.js'

export default function RoleProvider({ children }) {
  const auth = useAuth()

  const activeRole = auth.role || DEFAULT_ROLE
  const activeUser = auth.user
    ? {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        role: auth.role,
        rawRole: auth.user.role,
        customerId: auth.customerId,
        customer: auth.customer,
      }
    : DEMO_USERS[activeRole] || DEMO_USERS.admin

  const value = useMemo(
    () => ({
      role: activeRole,
      user: activeUser,
      definition: ROLE_DEFINITIONS[activeRole] || ROLE_DEFINITIONS.admin,
      isAuthenticated: auth.isAuthenticated,
      loading: auth.loading,
      logout: auth.logout,
    }),
    [activeRole, activeUser, auth.isAuthenticated, auth.loading, auth.logout],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}
