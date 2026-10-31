import PageHeader from '../../components/shared/PageHeader.jsx'
import UserAvatar from '../../components/shared/UserAvatar.jsx'
import Card from '../../components/ui/Card.jsx'
import useRole from '../../hooks/useRole.js'

export default function CustomerAccountPage() {
  const { user, definition } = useRole()

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="Account" description="Your profile details" />

      <Card className="max-w-2xl p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} className="h-14 w-14 text-base" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-sm text-foreground-muted">{user.title}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Email</dt>
            <dd className="truncate text-sm text-foreground">{user.email}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">Account type</dt>
            <dd className="text-sm text-foreground">{definition.label}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
