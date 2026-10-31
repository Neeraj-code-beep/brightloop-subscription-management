import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { InvoicesContext } from './InvoicesContext.js'
import { INITIAL_INVOICES } from '../data/invoices.js'
import { INITIAL_PAYMENTS } from '../data/payments.js'
import useRole from '../hooks/useRole.js'
import useSubscriptions from '../hooks/useSubscriptions.js'
import useDiscounts from '../hooks/useDiscounts.js'
import useTaxRules from '../hooks/useTaxRules.js'
import { buildInvoiceFromSubscription, confirmInvoice, markInvoiceSent, invoiceApi } from '../services/invoiceService.js'
import { buildPayment, paymentApi } from '../services/paymentService.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'
import { selectInvoiceDiscount } from '../utils/discountQueries.js'
import { getApplicableTax } from '../utils/taxQueries.js'
import { getInvoiceTotals, isPaymentPendingCollection } from '../utils/invoiceMath.js'
import { paidAmountFor } from '../utils/paymentQueries.js'

export default function InvoicesProvider({ children }) {
  const { user } = useRole()
  const { addSubscriptionActivity } = useSubscriptions()
  const { discounts, recordDiscountUse } = useDiscounts()
  const { taxRules } = useTaxRules()
  const [invoices, setInvoices] = useState(INITIAL_INVOICES)
  const [payments, setPayments] = useState(INITIAL_PAYMENTS)

  const loadData = useCallback(async () => {
    try {
      const [invRes, payRes] = await Promise.allSettled([
        invoiceApi.getInvoices({ limit: 100 }),
        paymentApi.getPayments({ limit: 100 }),
      ])

      if (invRes.status === 'fulfilled' && invRes.value) {
        const list = Array.isArray(invRes.value) ? invRes.value : invRes.value.invoices || []
        if (list.length > 0) {
          const mapped = list.map((inv) => ({
            id: inv.id,
            number: inv.invoiceNumber || inv.id,
            customerId: inv.customerId,
            subscriptionId: inv.subscription?.subscriptionNumber || inv.subscriptionId || '—',
            issueDate: inv.issueDate || inv.createdAt,
            dueDate: inv.dueDate,
            paymentTerms: inv.paymentTerms || 'Net 30',
            discountPercent: Number(inv.discountPercent || 0),
            status:
              inv.status === 'PAID'
                ? 'Paid'
                : inv.status === 'ISSUED'
                ? 'Confirmed'
                : inv.status === 'DRAFT'
                ? 'Draft'
                : inv.status === 'VOID'
                ? 'Void'
                : inv.status,
            totalAmount: Number(inv.totalAmount || 0),
            amountDue: Number(inv.amountDue || 0),
            amountPaid: Number(inv.amountPaid || 0),
            createdBy: inv.customer?.firstName || 'System',
            lines: (inv.items || inv.lineItems || []).map((item) => ({
              productName: item.description || item.product?.name || 'Subscription',
              quantity: item.quantity || 1,
              unitPrice: Number(item.unitPrice || item.amount || 0),
            })),
          }))
          setInvoices(mapped)
        }
      }

      if (payRes.status === 'fulfilled' && payRes.value) {
        const list = Array.isArray(payRes.value) ? payRes.value : payRes.value.payments || []
        if (list.length > 0) {
          const mapped = list.map((p) => ({
            id: p.paymentNumber || p.id,
            invoiceNumber: p.invoice?.invoiceNumber || p.invoiceId || '—',
            customerId: p.customerId,
            date: p.paymentDate || p.createdAt,
            method: p.paymentMethod || 'Manual',
            amount: Number(p.amount || 0),
            reference: p.reference || p.transactionReference || '',
            status: p.status === 'SUCCEEDED' ? 'Captured' : p.status,
          }))
          setPayments(mapped)
        }
      }
    } catch (err) {
      console.warn('Failed to load live invoices/payments:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getInvoice = useCallback(
    (invoiceNumber) => invoices.find((invoice) => invoice.number === invoiceNumber || invoice.id === invoiceNumber) ?? null,
    [invoices],
  )

  const updateInvoice = useCallback((invoiceNumber, update) => {
    setInvoices((previous) =>
      previous.map((invoice) => (invoice.number === invoiceNumber || invoice.id === invoiceNumber ? update(invoice) : invoice)),
    )
  }, [])

  const createInvoiceFromSubscription = useCallback(
    async (subscription) => {
      const discount = selectInvoiceDiscount(discounts, subscription, REFERENCE_DATE)
      const invoice = buildInvoiceFromSubscription(
        invoices,
        subscription,
        user.name,
        discount,
        getApplicableTax(taxRules),
      )
      setInvoices((previous) => [invoice, ...previous])

      // Attempt backend persistence
      try {
        await invoiceApi.createInvoice({
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          paymentTerms: subscription.paymentTerms || 'NET_30',
          items: invoice.lines.map((l) => ({
            description: l.productName,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        })
      } catch (err) {
        console.warn('Persisting invoice to backend failed:', err)
      }

      if (discount) recordDiscountUse(discount.id)
      addSubscriptionActivity(subscription.id, `Invoice ${invoice.number} created`)
      return invoice
    },
    [invoices, discounts, taxRules, user.name, addSubscriptionActivity, recordDiscountUse],
  )

  const confirmInvoiceById = useCallback(
    async (invoiceNumber) => {
      updateInvoice(invoiceNumber, confirmInvoice)
      try {
        const inv = getInvoice(invoiceNumber)
        if (inv?.id) {
          await invoiceApi.issueInvoice(inv.id)
        }
      } catch (err) {
        console.warn('Backend issue invoice failed:', err)
      }
    },
    [updateInvoice, getInvoice]
  )

  const sendInvoice = useCallback(
    (invoiceNumber, input) => updateInvoice(invoiceNumber, (invoice) => markInvoiceSent(invoice, input)),
    [updateInvoice],
  )

  const recordPayment = useCallback(
    async (invoiceNumber, input) => {
      const invoice = getInvoice(invoiceNumber)
      if (!invoice) return null

      const total = invoice.totalAmount || getInvoiceTotals(invoice).total
      const outstanding = total - paidAmountFor(payments, invoiceNumber)
      if (input.amount <= 0 || input.amount > outstanding) return null

      const payment = buildPayment(payments, invoice, input)
      setPayments((previous) => [payment, ...previous])

      // Attempt backend persistence
      try {
        await paymentApi.recordPayment({
          invoiceId: invoice.id || invoiceNumber,
          customerId: invoice.customerId,
          amount: Number(input.amount),
          paymentMethod: input.method || 'CASH',
          paymentDate: input.date || new Date().toISOString(),
          reference: input.reference || '',
        })
      } catch (err) {
        console.warn('Recording payment on backend failed:', err)
      }

      return payment
    },
    [getInvoice, payments]
  )

  const value = useMemo(
    () => ({
      invoices,
      payments,
      getInvoice,
      createInvoiceFromSubscription,
      confirmInvoiceById,
      sendInvoice,
      recordPayment,
      refreshInvoices: loadData,
    }),
    [
      invoices,
      payments,
      getInvoice,
      createInvoiceFromSubscription,
      confirmInvoiceById,
      sendInvoice,
      recordPayment,
      loadData,
    ],
  )

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>
}
