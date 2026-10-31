import { ROLES } from '../constants/roles.js'
import { CUSTOMERS, getCustomerById } from '../data/customers.js'
import { PLAN_OFFERS } from './productsPlansQueries.js'
import { getPlanById } from '../data/plans.js'
import { getCustomerEmail } from './customerContact.js'
import { getCustomerInvoices, toInvoiceRow } from './invoiceQueries.js'
import { formatINR } from './format.js'
import { getCustomerPayments } from './paymentQueries.js'
import { findCustomerSubscription } from './subscriptionQueries.js'

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_RESULT_LIMIT = 8

export const SEARCH_GROUPS = [
  { type: 'customer', label: 'Customers' },
  { type: 'subscription', label: 'Subscriptions' },
  { type: 'quotation', label: 'Quotations' },
  { type: 'invoice', label: 'Invoices' },
  { type: 'payment', label: 'Payments' },
  { type: 'plan', label: 'Products & Plans' },
  { type: 'discount', label: 'Discounts' },
  { type: 'tax', label: 'Tax rules' },
  { type: 'staff', label: 'Staff' },
  { type: 'account', label: 'Account' },
]

function entry({ type, id, title, detail, to, fields }) {
  return { type, id, title, detail, to, fields: fields.filter(Boolean) }
}

function buildQuotationEntries(subscriptions, to) {
  return subscriptions
    .filter((subscription) => subscription.quotationNumber)
    .map((subscription) => {
      const customerName = getCustomerById(subscription.customerId)?.name ?? 'Unknown customer'
      return entry({
        type: 'quotation',
        id: subscription.quotationNumber,
        title: subscription.quotationNumber,
        detail: `${customerName} · ${subscription.status}`,
        to: to(subscription),
        fields: [subscription.quotationNumber, subscription.id, customerName],
      })
    })
}

function buildWorkspaceEntries({ subscriptions, invoices, payments, taxRules, discounts, staff }) {
  const customers = CUSTOMERS.map((customer) => {
    const email = getCustomerEmail(customer.id)
    return entry({
      type: 'customer',
      id: customer.id,
      title: customer.name,
      detail: email ?? `${customer.contact} · ${customer.city}`,
      to: `/customers/${customer.id}`,
      fields: [customer.name, customer.contact, customer.id, email],
    })
  })

  const subscriptionEntries = subscriptions.map((subscription) => {
    const plan = getPlanById(subscription.planId)
    const customerName = getCustomerById(subscription.customerId)?.name ?? 'Unknown customer'
    return entry({
      type: 'subscription',
      id: subscription.id,
      title: subscription.id,
      detail: `${plan.name} · ${customerName}`,
      to: `/subscriptions/${subscription.id}`,
      fields: [subscription.id, plan.name, plan.productName, customerName],
    })
  })

  const invoiceEntries = invoices.map(toInvoiceRow).map(({ invoice, customerName, status }) =>
    entry({
      type: 'invoice',
      id: invoice.number,
      title: invoice.number,
      detail: `${customerName} · ${status}`,
      to: `/invoices/${invoice.number}`,
      fields: [invoice.number, customerName],
    }),
  )

  const paymentEntries = payments.map((payment) => {
    const customerName = getCustomerById(payment.customerId)?.name ?? 'Unknown customer'
    return entry({
      type: 'payment',
      id: payment.id,
      title: payment.id,
      detail: `${customerName} · ${payment.invoiceNumber}`,
      to: `/invoices/${payment.invoiceNumber}`,
      fields: [payment.id, payment.invoiceNumber, customerName],
    })
  })

  const planEntries = PLAN_OFFERS.map((offer) =>
    entry({
      type: 'plan',
      id: offer.id,
      title: `${offer.planName} · ${offer.billingFrequency}`,
      detail: offer.productName,
      to: `/products-plans/${offer.id}`,
      fields: [offer.planName, offer.productName, offer.type, offer.billingFrequency],
    }),
  )

  const taxEntries = taxRules.map((rule) =>
    entry({
      type: 'tax',
      id: rule.id,
      title: rule.name,
      detail: `${rule.rate}% · ${rule.status}`,
      to: '/taxes',
      fields: [rule.name, rule.id],
    }),
  )

  const discountEntries = discounts.map((discount) =>
    entry({
      type: 'discount',
      id: discount.id,
      title: discount.name,
      detail: discount.code,
      to: '/discounts',
      fields: [discount.name, discount.code, discount.id],
    }),
  )

  const staffEntries = staff.map((member) =>
    entry({
      type: 'staff',
      id: member.id,
      title: member.name,
      detail: `${member.role} · ${member.email}`,
      to: '/staff',
      fields: [member.name, member.email, member.id],
    }),
  )

  return [
    ...customers,
    ...subscriptionEntries,
    ...buildQuotationEntries(subscriptions, (subscription) => `/subscriptions/${subscription.id}`),
    ...invoiceEntries,
    ...paymentEntries,
    ...planEntries,
    ...discountEntries,
    ...taxEntries,
    ...staffEntries,
  ]
}

function buildCustomerEntries({ user, subscriptions, invoices, payments }) {
  const entries = [
    entry({
      type: 'account',
      id: user.customerId,
      title: user.name,
      detail: user.email,
      to: '/customer/account',
      fields: [user.name, user.email],
    }),
  ]

  const subscription = findCustomerSubscription(subscriptions, user.customerId)
  if (subscription) {
    const plan = getPlanById(subscription.planId)
    entries.push(
      entry({
        type: 'subscription',
        id: subscription.id,
        title: subscription.id,
        detail: plan.name,
        to: '/customer/subscription',
        fields: [subscription.id, plan.name, plan.productName],
      }),
    )
  }
  buildQuotationEntries(subscriptions.filter((item) => item.customerId === user.customerId), () => '/customer/subscription').forEach((item) => entries.push(item))

  getCustomerInvoices(invoices, user.customerId)
    .map(toInvoiceRow)
    .forEach(({ invoice, status }) => {
      entries.push(
        entry({
          type: 'invoice',
          id: invoice.number,
          title: invoice.number,
          detail: status,
          to: `/customer/invoices/${invoice.number}`,
          fields: [invoice.number],
        }),
      )
    })

  getCustomerPayments(payments, user.customerId).forEach((payment) => {
    entries.push(
      entry({
        type: 'payment',
        id: payment.id,
        title: payment.id,
        detail: `${payment.invoiceNumber} · ${formatINR(payment.amount)}`,
        to: `/customer/invoices/${payment.invoiceNumber}`,
        fields: [payment.id, payment.invoiceNumber],
      }),
    )
  })

  return entries
}

export function buildSearchIndex({ role, user, subscriptions, invoices, payments, taxRules, discounts, staff }) {
  if (role === ROLES.CUSTOMER) return buildCustomerEntries({ user, subscriptions, invoices, payments })
  const visibleStaff = role === ROLES.ADMIN ? staff : []
  return buildWorkspaceEntries({ subscriptions, invoices, payments, taxRules, discounts, staff: visibleStaff })
}

export function searchIndex(index, rawQuery, limit = SEARCH_RESULT_LIMIT) {
  const query = rawQuery.trim().toLowerCase()
  if (query.length < SEARCH_MIN_LENGTH) return []

  const hits = index
    .filter((item) => item.fields.some((field) => field.toLowerCase().includes(query)))
    .slice(0, limit)

  return SEARCH_GROUPS.map((group) => ({
    ...group,
    results: hits.filter((item) => item.type === group.type),
  })).filter((group) => group.results.length > 0)
}
