import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/shared/EmptyState.jsx'
import { buttonVariants } from '../components/ui/buttonStyles.js'

export default function NotFoundPage() {
  return (
    <div className="py-8">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Link to="/" className={buttonVariants({ variant: 'primary' })}>
            Back to home
          </Link>
        }
      />
    </div>
  )
}
