import { Building2, Moon, Receipt, Sun } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader.jsx'
import Card from '../../components/ui/Card.jsx'
import { PAYMENT_TERMS, TAX_RATE_PERCENT } from '../../constants/subscriptions.js'
import useTaxRules from '../../hooks/useTaxRules.js'
import useTheme from '../../hooks/useTheme.js'
import { DEMO_USERS } from '../../data/users.js'
import { ROLES } from '../../constants/roles.js'
import { cn } from '../../utils/cn.js'

const COMPANY = {
  name: 'Brightloop Software',
  currency: 'Indian Rupee (INR)',
  contact: DEMO_USERS[ROLES.ADMIN].email,
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-text">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-foreground-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

export default function SettingsPage() {
  const { taxRules } = useTaxRules()
  const { theme, setTheme } = useTheme()
  const standardRule = taxRules.find((rule) => rule.rate === TAX_RATE_PERCENT && rule.status === 'Active')

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="Settings" description="Company details, billing defaults, and how the workspace looks." />

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsCard icon={Building2} title="Company" description="The business that issues invoices and quotations.">
          <dl>
            <ReadOnlyRow label="Company name" value={COMPANY.name} />
            <ReadOnlyRow label="Billing contact" value={COMPANY.contact} />
          </dl>
        </SettingsCard>

        <SettingsCard icon={Receipt} title="Billing" description="Defaults applied when creating invoices.">
          <dl>
            <ReadOnlyRow label="Currency" value={COMPANY.currency} />
            <ReadOnlyRow
              label="Standard tax rate"
              value={standardRule ? `${standardRule.name} (included in prices)` : `${TAX_RATE_PERCENT}% (included in prices)`}
            />
            <ReadOnlyRow label="Payment terms available" value={PAYMENT_TERMS.join(', ')} />
          </dl>
        </SettingsCard>

        <SettingsCard icon={Sun} title="Appearance" description="Choose how the workspace looks on this device.">
          <div role="group" aria-label="Theme" className="grid grid-cols-2 gap-3">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary-soft text-primary-soft-text'
                      : 'border-border bg-surface text-foreground hover:bg-surface-muted',
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}
