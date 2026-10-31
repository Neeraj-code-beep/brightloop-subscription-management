import { REFERENCE_DATE } from '../constants/subscriptions.js'

export const STAFF_ROLES = ['Admin', 'Staff']
export const STAFF_STATUSES = ['Active', 'Inactive']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateStaffDraft(draft, staff) {
  const errors = {}
  const name = draft.name.trim()
  const email = draft.email.trim().toLowerCase()

  if (!name) errors.name = 'Enter the staff member\'s full name.'
  if (!email) {
    errors.email = 'Enter an email address.'
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address, such as name@company.com.'
  } else if (staff.some((member) => member.email.toLowerCase() === email)) {
    errors.email = 'Another staff member already uses this email.'
  }
  if (!STAFF_ROLES.includes(draft.role)) errors.role = 'Choose a role.'
  if (!STAFF_STATUSES.includes(draft.status)) errors.status = 'Choose a status.'

  return errors
}

function nextStaffId(staff) {
  const highest = staff.reduce((max, member) => {
    const number = Number(member.id.replace('STF-', ''))
    return Number.isNaN(number) ? max : Math.max(max, number)
  }, 0)
  return `STF-${String(highest + 1).padStart(3, '0')}`
}

export function buildStaffRecord(draft, staff) {
  return {
    id: nextStaffId(staff),
    name: draft.name.trim(),
    email: draft.email.trim().toLowerCase(),
    role: draft.role,
    status: draft.status,
    addedOn: REFERENCE_DATE,
  }
}
