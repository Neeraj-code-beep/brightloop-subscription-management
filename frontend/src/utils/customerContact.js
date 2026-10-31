import { DEMO_USERS } from '../data/users.js'

export function getCustomerEmail(customerId) {
  return Object.values(DEMO_USERS).find((user) => user.customerId === customerId)?.email ?? null
}
