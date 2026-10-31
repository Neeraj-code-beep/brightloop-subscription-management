import {
  ChartColumn,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  Repeat,
  Settings,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { ROLES } from './roles.js'

export const ADMIN_AND_STAFF = [ROLES.ADMIN, ROLES.STAFF]

export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ADMIN_AND_STAFF },
      { label: 'Dashboard', path: '/customer/dashboard', icon: LayoutDashboard, roles: [ROLES.CUSTOMER] },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Subscriptions', path: '/subscriptions', icon: Repeat, roles: ADMIN_AND_STAFF },
      { label: 'Invoices', path: '/invoices', icon: FileText, roles: ADMIN_AND_STAFF },
      { label: 'Payments', path: '/payments', icon: CreditCard, roles: ADMIN_AND_STAFF },
      { label: 'Discounts', path: '/discounts', icon: Percent, roles: ADMIN_AND_STAFF },
      { label: 'Taxes', path: '/taxes', icon: Receipt, roles: ADMIN_AND_STAFF },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Customers', path: '/customers', icon: Users, roles: ADMIN_AND_STAFF },
      { label: 'Products & Plans', path: '/products-plans', icon: Package, roles: ADMIN_AND_STAFF },
      { label: 'Staff', path: '/staff', icon: UserCog, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', path: '/reports', icon: ChartColumn, roles: ADMIN_AND_STAFF }],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', path: '/settings', icon: Settings, roles: [ROLES.ADMIN] }],
  },
  {
    label: 'My account',
    items: [
      { label: 'My Subscription', path: '/customer/subscription', icon: Repeat, roles: [ROLES.CUSTOMER] },
      { label: 'My Invoices', path: '/customer/invoices', icon: FileText, roles: [ROLES.CUSTOMER] },
      { label: 'My Payments', path: '/customer/payments', icon: CreditCard, roles: [ROLES.CUSTOMER] },
      { label: 'Account', path: '/customer/account', icon: UserRound, roles: [ROLES.CUSTOMER] },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

export function getNavGroupsForRole(role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}
