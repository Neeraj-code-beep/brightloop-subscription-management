import { Plus, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import StaffForm from '../../components/staff/StaffForm.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import Card from '../../components/ui/Card.jsx'
import Modal from '../../components/ui/Modal.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import useStaff from '../../hooks/useStaff.js'
import useToast from '../../hooks/useToast.js'
import { formatDate } from '../../utils/format.js'

export default function StaffPage() {
  const { staff, createStaff } = useStaff()
  const { showToast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  function handleCreate(draft) {
    const result = createStaff(draft)
    if (result.errors) return result

    setCreateOpen(false)
    showToast({
      title: `${result.staff.name} added`,
      description: `${result.staff.email} now has ${result.staff.role} access.`,
    })
    return result
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Staff"
        description="People who can sign in to the billing workspace."
        action={
          <button type="button" onClick={() => setCreateOpen(true)} className={buttonVariants({ variant: 'primary' })}>
            <Plus size={16} aria-hidden="true" />
            Add staff member
          </button>
        }
      />

      <Card className="overflow-hidden">
        {staff.length === 0 ? (
          <EmptyState icon={Users} title="No staff yet" description="Add the people who will manage billing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-muted">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Added'].map((label) => (
                    <th key={label} scope="col" className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{member.name}</td>
                    <td className="px-4 py-3 text-sm text-foreground-muted">{member.email}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{member.role}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-foreground-muted">{formatDate(member.addedOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={closeCreate} size="md" title="Add staff member" description="They will get access to the billing workspace with this role.">
        <StaffForm onSubmit={handleCreate} onCancel={closeCreate} />
      </Modal>
    </div>
  )
}
