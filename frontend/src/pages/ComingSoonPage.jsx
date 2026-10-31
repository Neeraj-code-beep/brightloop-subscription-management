import { Hourglass } from 'lucide-react'
import EmptyState from '../components/shared/EmptyState.jsx'
import Card from '../components/ui/Card.jsx'

export default function ComingSoonPage({ title }) {
  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icon={Hourglass}
        title={`${title} is coming soon`}
        description="This section is on the roadmap for the next implementation step."
      />
    </Card>
  )
}
