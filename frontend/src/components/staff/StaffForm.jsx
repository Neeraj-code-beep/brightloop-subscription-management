import { useState } from 'react'
import FormField from '../ui/FormField.jsx'
import Input from '../ui/Input.jsx'
import { buttonVariants } from '../ui/buttonStyles.js'
import { STAFF_ROLES, STAFF_STATUSES } from '../../services/staffService.js'

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20'

const EMPTY_DRAFT = { name: '', email: '', role: 'Staff', status: 'Active' }

export default function StaffForm({ onSubmit, onCancel }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [errors, setErrors] = useState({})

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const result = onSubmit(draft)
    if (result?.errors) setErrors(result.errors)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField id="staff-name" label="Full name" error={errors.name}>
          <Input
            id="staff-name"
            value={draft.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="e.g. Meera Iyer"
            autoComplete="off"
          />
        </FormField>

        <FormField id="staff-email" label="Work email" error={errors.email} hint="Must be unique across staff.">
          <Input
            id="staff-email"
            type="email"
            value={draft.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="name@brightloop.in"
            autoComplete="off"
          />
        </FormField>

        <FormField id="staff-role" label="Role" error={errors.role}>
          <select id="staff-role" value={draft.role} onChange={(event) => updateField('role', event.target.value)} className={selectClass}>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="staff-status" label="Status" error={errors.status}>
          <select id="staff-status" value={draft.status} onChange={(event) => updateField('status', event.target.value)} className={selectClass}>
            {STAFF_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </button>
        <button type="submit" className={buttonVariants({ variant: 'primary' })}>
          Add staff member
        </button>
      </div>
    </form>
  )
}
