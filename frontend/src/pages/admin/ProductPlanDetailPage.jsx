import { ArrowLeft, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import SubscriptionTable from '../../components/subscriptions/SubscriptionTable.jsx'
import EmptyState from '../../components/shared/EmptyState.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import Card from '../../components/ui/Card.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import useInvoices from '../../hooks/useInvoices.js'
import useSubscriptions from '../../hooks/useSubscriptions.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { getOfferAvailability, getPlanOfferDetail } from '../../utils/productsPlansQueries.js'

function DetailField({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-foreground-subtle">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children}
    </Card>
  )
}

function NotFoundState() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Product or plan not found"
        description="This plan may have been removed, or the link is incorrect."
        action={
          <Link to="/products-plans" className={buttonVariants({ variant: 'secondary' })}>
            Back to products & plans
          </Link>
        }
      />
    </Card>
  )
}

export default function ProductPlanDetailPage() {
  const { id } = useParams()
  const { subscriptions } = useSubscriptions()
  const { invoices, payments } = useInvoices()

  const detail = useMemo(
    () => getPlanOfferDetail(id, { subscriptions, invoices, payments }),
    [id, subscriptions, invoices, payments],
  )

  if (!detail) return <NotFoundState />

  const { offer, usage, relatedRows } = detail
  const usageStats = [
    { label: 'Active subscriptions', value: String(usage.activeSubscriptions) },
    { label: 'Total subscriptions', value: String(usage.related.length) },
    { label: 'Revenue collected', value: formatINR(usage.revenue) },
  ]

  return (
    <div className="space-y-6">
      <Link
        to="/products-plans"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-150 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to products & plans
      </Link>

      <PageHeader
        title={offer.planName}
        description={`${offer.productName} · ${offer.billingFrequency}`}
        action={<StatusBadge status={offer.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Overview">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <DetailField label="Product" value={offer.productName} />
            <DetailField label="Type" value={offer.type} />
            <DetailField label="Status" value={<StatusBadge status={offer.status} />} />
          </dl>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground-subtle">Notes</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
              {offer.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Pricing">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <DetailField label="Sales price" value={<span className="tabular-nums">{formatINR(offer.salesPrice)}</span>} />
            <DetailField
              label="Cost price"
              value={offer.costPrice === null ? 'Not set' : <span className="tabular-nums">{formatINR(offer.costPrice)}</span>}
            />
            <DetailField label="Billing frequency" value={offer.billingFrequency} />
            <DetailField label="Minimum quantity" value={offer.minQuantity} />
          </dl>
        </SectionCard>

        <SectionCard title="Availability">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <DetailField
              label="Start date"
              value={offer.availabilityStart ? formatDate(offer.availabilityStart) : 'Not set'}
            />
            <DetailField
              label="End date"
              value={offer.availabilityEnd ? formatDate(offer.availabilityEnd) : 'No end date'}
            />
            <DetailField label="Current availability" value={getOfferAvailability(offer)} />
          </dl>
        </SectionCard>
      </div>

      <section className="space-y-3" aria-labelledby="usage-heading">
        <h3 id="usage-heading" className="text-base font-semibold text-foreground">
          Usage
        </h3>
        <StatStrip stats={usageStats} ariaLabel="Plan usage" />
      </section>

      <section className="space-y-3" aria-labelledby="related-subscriptions-heading">
        <h3 id="related-subscriptions-heading" className="text-base font-semibold text-foreground">
          Related subscriptions
        </h3>
        {relatedRows.length > 0 ? (
          <SubscriptionTable rows={relatedRows} />
        ) : (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No subscriptions use this plan yet"
              description="Subscriptions on this plan and billing frequency will be listed here."
            />
          </Card>
        )}
      </section>
    </div>
  )
}
