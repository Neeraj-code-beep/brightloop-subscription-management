import { ROLES } from '../constants/roles.js'

export const DEMO_USERS = {
  [ROLES.ADMIN]: {
    name: 'Ananya Rao',
    title: 'Administrator',
    email: 'ananya.rao@brightloop.in',
  },
  [ROLES.STAFF]: {
    name: 'Rahul Mehta',
    title: 'Billing Operations',
    email: 'rahul.mehta@brightloop.in',
  },
  [ROLES.CUSTOMER]: {
    name: 'Priya Sharma',
    title: 'Customer',
    email: 'priya.sharma@gmail.com',
    customerId: 'CUS-1024',
  },
}
