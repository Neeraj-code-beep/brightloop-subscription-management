import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import CreateTaxRuleForm from '../../components/taxes/CreateTaxRuleForm.jsx'
import TaxRulesTable from '../../components/taxes/TaxRulesTable.jsx'
import PageHeader from '../../components/shared/PageHeader.jsx'
import StatStrip from '../../components/shared/StatStrip.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { buttonVariants } from '../../components/ui/buttonStyles.js'
import { ROLES } from '../../constants/roles.js'
import useRole from '../../hooks/useRole.js'
import useTaxRules from '../../hooks/useTaxRules.js'
import useToast from '../../hooks/useToast.js'
import { getApplicableTax, summarizeTaxRules } from '../../utils/taxQueries.js'

export default function TaxesPage() {
  const { role } = useRole()
  const { taxRules, createTaxRule } = useTaxRules()
  const { showToast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)

  const summary = useMemo(() => summarizeTaxRules(taxRules), [taxRules])
  const applicableTax = getApplicableTax(taxRules)

  const stats = [
    { label: 'Active tax rules', value: String(summary.active) },
    { label: 'Total tax rules', value: String(summary.total) },
    { label: 'Highest tax rate', value: summary.highestRate === null ? '—' : `${summary.highestRate}%` },
  ]

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const handleCreate = useCallback(
    (draft) => {
      const result = createTaxRule(draft)
      if (result.errors) return result.errors

      setCreateOpen(false)
      showToast({ title: `Tax rule ${result.taxRule.name} created successfully` })
      return null
    },
    [createTaxRule, showToast],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Rules"
        description="Configure tax rates applied to subscription invoices."
        action={
          role === ROLES.ADMIN && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={buttonVariants({ variant: 'primary' })}
            >
              <Plus size={16} aria-hidden="true" />
              New Tax Rule
            </button>
          )
        }
      />

      <StatStrip stats={stats} ariaLabel="Tax rule summary" />

      <p className="text-sm text-foreground-muted">
        {applicableTax
          ? `New invoices include ${applicableTax.name} unless the subscription specifies otherwise.`
          : 'No active GST 18% rule exists, so new invoices are created without tax.'}
      </p>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        size="lg"
        title="New Tax Rule"
        description="Add a tax rate that can be applied to subscription invoices."
      >
        <CreateTaxRuleForm onSubmit={handleCreate} onCancel={closeCreate} />
      </Modal>

      <TaxRulesTable rules={taxRules} />
    </div>
  )
}
