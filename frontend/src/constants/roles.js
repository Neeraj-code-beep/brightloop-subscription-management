export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
}

export const ROLE_IDS = Object.values(ROLES)

export const DEFAULT_ROLE = ROLES.ADMIN

export const ROLE_DEFINITIONS = {
  [ROLES.ADMIN]: {
    label: 'Admin',
    home: '/dashboard',
    accountPath: '/settings',
    accountLabel: 'Settings',
  },
  [ROLES.STAFF]: {
    label: 'Staff',
    home: '/dashboard',
    accountPath: null,
    accountLabel: null,
  },
  [ROLES.CUSTOMER]: {
    label: 'Customer',
    home: '/customer/dashboard',
    accountPath: '/customer/account',
    accountLabel: 'My account',
  },
}

export const STORAGE_KEYS = {
  role: 'brightloop-role',
  theme: 'brightloop-theme',
}
