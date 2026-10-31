import StatusBadge from '../ui/StatusBadge.jsx'

export default function SubscriptionStatusBadge({ status, paused = false }) {
  return <StatusBadge status={paused && status === 'Active' ? 'Paused' : status} />
}
