import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/shared/EmptyState.jsx'
import Card from '../components/ui/Card.jsx'
import { buttonVariants } from '../components/ui/buttonStyles.js'
import useRole from '../hooks/useRole.js'

export default function AccessRestrictedPage() {
  const { definition } = useRole()

  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icon={Lock}
        title="Access restricted"
        description={`This section isn't available to the ${definition.label} role. Use the demo role menu in your account to view another workspace.`}
        action={
          <Link to={definition.home} className={buttonVariants({ variant: 'primary' })}>
            Go to my workspace
          </Link>
        }
      />
    </Card>
  )
}
