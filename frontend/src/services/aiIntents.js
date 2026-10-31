import { ROLES } from '../constants/roles.js'
import { REFERENCE_DATE } from '../constants/subscriptions.js'
import { formatDate, formatINR } from '../utils/format.js'

const ADMIN_STAFF = [ROLES.ADMIN, ROLES.STAFF]
const ALL_ROLES = [ROLES.ADMIN, ROLES.STAFF, ROLES.CUSTOMER]
const OPEN_STATUSES = ['Confirmed', 'Overdue']
const INVOICE_NUMBER = /bl-\d{4}-\d{4}/
const PAYMENT_ID = /pay-\d{4}/
const SUBSCRIPTION_ID = /bl-sub-\d{4}/
const FOLLOW_UP = /customers?.*(unpaid|follow|owe|outstanding|overdue|payment)|follow-?up/
const CUSTOMER_LOOKUP_MIN_WORD = 4

const isOpen = (invoice) => OPEN_STATUSES.includes(invoice.status)
const isCustomerScope = (context) => context.scope === ROLES.CUSTOMER
const who = (context) => (isCustomerScope(context) ? 'You currently have' : 'Brightloop currently has')
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0)
const newestFirst = (key) => (a, b) => b[key].localeCompare(a[key])
const reply = (text, items = []) => ({ status: 'answer', text, items })
const notFound = (kind, id, context) =>
  isCustomerScope(context) ? `I couldn't find ${kind} ${id} in your account.` : `No ${kind} ${id} was found.`

const invoiceItem = (invoice, secondary, value) => ({
  id: invoice.number,
  primary: invoice.number,
  secondary,
  value,
})

const paymentItem = (payment) => ({
  id: payment.id,
  primary: `${payment.id} · ${payment.customerName}`,
  secondary: `${payment.invoiceNumber} · ${formatDate(payment.date)} · ${payment.method}`,
  value: formatINR(payment.amount),
})

function matchCustomers(customers, question) {
  const exact = customers.filter((customer) => question.includes(customer.name.toLowerCase()))
  if (exact.length > 0) return exact

  const words = question.split(/[^a-z]+/)
  return customers.filter((customer) => {
    const firstWord = customer.name.toLowerCase().split(' ')[0]
    return firstWord.length >= CUSTOMER_LOOKUP_MIN_WORD && words.includes(firstWord)
  })
}

export const AI_INTENTS = [
  {
    roles: ALL_ROLES,
    matches: (question) => INVOICE_NUMBER.test(question),
    answer: (context, question) => {
      const number = question.match(INVOICE_NUMBER)[0].toUpperCase()
      const invoice = context.invoices.find((item) => item.number === number)
      if (!invoice) return reply(notFound('invoice', number, context))
      return reply(
        `${invoice.number} for ${invoice.customerName} is ${invoice.status}. Total ${formatINR(invoice.total)}, paid ${formatINR(invoice.paid)}, balance ${formatINR(invoice.balance)}, due ${formatDate(invoice.dueDate)}.`,
      )
    },
  },
  {
    roles: ALL_ROLES,
    matches: (question) => PAYMENT_ID.test(question),
    answer: (context, question) => {
      const id = question.match(PAYMENT_ID)[0].toUpperCase()
      const payment = context.payments.find((item) => item.id === id)
      if (!payment) return reply(notFound('payment', id, context))
      return reply(
        `${payment.id} is a ${formatINR(payment.amount)} ${payment.method} payment from ${payment.customerName} on ${formatDate(payment.date)}, applied to ${payment.invoiceNumber}.`,
      )
    },
  },
  {
    roles: ALL_ROLES,
    matches: (question) => SUBSCRIPTION_ID.test(question),
    answer: (context, question) => {
      const id = question.match(SUBSCRIPTION_ID)[0].toUpperCase()
      const subscription = context.subscriptions.find((item) => item.id === id)
      if (!subscription) return reply(notFound('subscription', id, context))
      const nextBilling = subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : 'not scheduled'
      return reply(
        `${subscription.id} for ${subscription.customerName} is ${subscription.status} on the ${subscription.planName} plan (${subscription.billingFrequency.toLowerCase()}). Next billing: ${nextBilling}.`,
      )
    },
  },
  {
    roles: ADMIN_STAFF,
    matches: (question, context) => matchCustomers(context.customers, question).length > 0,
    answer: (context, question) => {
      const matches = matchCustomers(context.customers, question)
      if (matches.length > 1) {
        return reply(
          'Which customer do you mean?',
          matches.map((customer) => ({ id: customer.id, primary: customer.name, secondary: 'Customer' })),
        )
      }

      const [customer] = matches
      const invoices = context.invoices
        .filter((invoice) => invoice.customerId === customer.id)
        .sort(newestFirst('issueDate'))
      const payments = context.payments.filter((payment) => payment.customerId === customer.id)
      const subscriptions = context.subscriptions.filter((subscription) => subscription.customerId === customer.id)
      const open = invoices.filter(isOpen)

      const subscriptionText = subscriptions.length
        ? `${subscriptions[0].status} ${subscriptions[0].planName} subscription (${subscriptions[0].billingFrequency.toLowerCase()})`
        : 'no subscription on record'
      const balanceText = open.length
        ? `${formatINR(sum(open, 'balance'))} outstanding across ${plural(open.length, 'open invoice')}`
        : 'no outstanding balance'

      return reply(
        `${customer.name}: ${subscriptionText}, ${balanceText}. ${plural(payments.length, 'payment')} on record totalling ${formatINR(sum(payments, 'amount'))}.`,
        invoices.slice(0, 5).map((invoice) =>
          invoiceItem(invoice, `${invoice.status} · due ${formatDate(invoice.dueDate)}`, formatINR(invoice.total)),
        ),
      )
    },
  },
  {
    roles: ADMIN_STAFF,
    matches: (question) => FOLLOW_UP.test(question),
    answer: (context) => {
      const byCustomer = new Map()
      context.invoices.filter(isOpen).forEach((invoice) => {
        const entry = byCustomer.get(invoice.customerId) ?? {
          id: invoice.customerId,
          name: invoice.customerName,
          count: 0,
          balance: 0,
          overdue: 0,
        }
        entry.count += 1
        entry.balance += invoice.balance
        if (invoice.status === 'Overdue') entry.overdue += 1
        byCustomer.set(invoice.customerId, entry)
      })

      const rows = [...byCustomer.values()].sort((a, b) => b.balance - a.balance)
      if (rows.length === 0) return reply('No customers have unpaid invoices right now.')

      const customerPhrase = rows.length === 1 ? '1 customer has' : `${rows.length} customers have`
      return reply(
        `${customerPhrase} unpaid invoices totalling ${formatINR(sum(rows, 'balance'))}.`,
        rows.slice(0, 6).map((row) => ({
          id: row.id,
          primary: row.name,
          secondary: `${plural(row.count, 'open invoice')}${row.overdue ? `, ${row.overdue} overdue` : ''}`,
          value: formatINR(row.balance),
        })),
      )
    },
  },
  {
    roles: ALL_ROLES,
    matches: (question) => /overdue|past due/.test(question),
    answer: (context) => {
      const overdue = context.invoices
        .filter((invoice) => invoice.status === 'Overdue')
        .sort((a, b) => b.daysPastDue - a.daysPastDue)
      if (overdue.length === 0) return reply(`${who(context)} no overdue invoices right now.`)

      return reply(
        `${who(context)} ${plural(overdue.length, 'overdue invoice')} totalling ${formatINR(sum(overdue, 'balance'))}. The oldest is ${overdue[0].daysPastDue} days past due.`,
        overdue.slice(0, 6).map((invoice) =>
          invoiceItem(
            invoice,
            `${invoice.customerName} · ${invoice.daysPastDue} days past due`,
            formatINR(invoice.balance),
          ),
        ),
      )
    },
  },
  {
    roles: ALL_ROLES,
    matches: (question) => /outstanding|unpaid|still owe|balance due|\bowe\b/.test(question),
    answer: (context) => {
      const open = context.invoices.filter(isOpen).sort((a, b) => b.balance - a.balance)
      if (open.length === 0) return reply(`${who(context)} no outstanding balance right now.`)

      return reply(
        `${who(context)} ${formatINR(sum(open, 'balance'))} outstanding across ${plural(open.length, 'unpaid invoice')}.`,
        open.slice(0, 6).map((invoice) =>
          invoiceItem(invoice, `${invoice.customerName} · due ${formatDate(invoice.dueDate)}`, formatINR(invoice.balance)),
        ),
      )
    },
  },
  {
    roles: ADMIN_STAFF,
    matches: (question) => /(recent|latest|today|last|show).*payments?|payments?.*today/.test(question),
    answer: (context, question) => {
      if (context.payments.length === 0) return reply('No payments are on record yet.')

      if (question.includes('today')) {
        const today = context.payments.filter((payment) => payment.date === REFERENCE_DATE)
        if (today.length === 0) return reply('No payments were recorded today.')
        return reply(
          `${plural(today.length, 'payment')} recorded today totalling ${formatINR(sum(today, 'amount'))}.`,
          today.map(paymentItem),
        )
      }

      const recent = [...context.payments].sort(newestFirst('date')).slice(0, 5)
      return reply(
        `Here are the ${recent.length} most recent payments, totalling ${formatINR(sum(recent, 'amount'))}.`,
        recent.map(paymentItem),
      )
    },
  },
  {
    roles: ADMIN_STAFF,
    matches: (question) => /active subscriptions?|how many subscriptions|subscription count|number of subscriptions/.test(question),
    answer: (context) => {
      const active = context.subscriptions.filter((subscription) => subscription.status === 'Active').length
      return reply(
        `Brightloop has ${plural(active, 'active subscription')} out of ${context.subscriptions.length} on record.`,
      )
    },
  },
  {
    roles: [ROLES.ADMIN],
    matches: (question) => /\bmrr\b|monthly recurring/.test(question),
    answer: (context) => {
      const active = context.subscriptions.filter((subscription) => subscription.status === 'Active').length
      return reply(
        `Estimated MRR is ${formatINR(context.mrr)} across ${plural(active, 'active subscription')}. This is a demo estimate from current plan list prices, not a reconciled figure from billing records.`,
      )
    },
  },
  {
    roles: [ROLES.ADMIN],
    matches: (question) => /revenue|collected|came in|income/.test(question),
    answer: (context) => {
      const month = REFERENCE_DATE.slice(0, 7)
      const monthPayments = context.payments.filter((payment) => payment.date.startsWith(month))
      const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${month}-01T00:00:00Z`),
      )
      return reply(
        `${formatINR(sum(monthPayments, 'amount'))} came in during ${label} across ${plural(monthPayments.length, 'payment')}.`,
      )
    },
  },
  {
    roles: [ROLES.ADMIN],
    matches: (question) => /\bplans?\b|products?/.test(question),
    answer: (context) =>
      reply(
        `Brightloop offers ${plural(context.plans.length, 'plan')}.`,
        context.plans.map((plan) => ({
          id: plan.id,
          primary: plan.name,
          secondary: plan.productName,
          value: `${formatINR(plan.monthlyPrice)}/mo`,
        })),
      ),
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /status/.test(question),
    answer: (context) => {
      const [subscription] = context.subscriptions
      if (!subscription) return reply('You do not have a subscription on record yet.')
      return reply(`Your subscription ${subscription.id} is ${subscription.status.toLowerCase()}.`)
    },
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /\bplan\b|subscription/.test(question),
    answer: (context) => {
      const [subscription] = context.subscriptions
      if (!subscription) return reply('You do not have a subscription on record yet.')
      return reply(
        `You are on the ${subscription.planName} plan: ${formatINR(subscription.amountPerCycle)} billed ${subscription.billingFrequency.toLowerCase()}.`,
      )
    },
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /next|when|due|renew/.test(question),
    answer: (context) => {
      const [nextInvoice] = context.invoices
        .filter(isOpen)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      if (nextInvoice) {
        const dueText =
          nextInvoice.status === 'Overdue'
            ? `overdue since ${formatDate(nextInvoice.dueDate)}`
            : `due ${formatDate(nextInvoice.dueDate)}`
        return reply(
          `Your next payment is ${formatINR(nextInvoice.balance)} for invoice ${nextInvoice.number}, ${dueText}.`,
        )
      }

      const [subscription] = context.subscriptions
      if (subscription?.nextBillingDate) {
        return reply(
          `You have no open invoices. Your next billing date is ${formatDate(subscription.nextBillingDate)}.`,
        )
      }
      return reply('You have no upcoming payments scheduled.')
    },
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /latest invoice|last invoice|recent invoice|most recent invoice|newest invoice/.test(question),
    answer: (context) => {
      const [latest] = [...context.invoices].sort(newestFirst('issueDate'))
      if (!latest) return reply('You do not have any invoices yet.')
      return reply(
        `Your latest invoice is ${latest.number}, issued ${formatDate(latest.issueDate)} for ${formatINR(latest.total)} (${latest.status.toLowerCase()}).`,
      )
    },
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /payment|paid|history/.test(question),
    answer: (context) => {
      if (context.payments.length === 0) return reply('You have no payments on record yet.')
      const history = [...context.payments].sort(newestFirst('date'))
      return reply(
        `You have made ${plural(history.length, 'payment')} totalling ${formatINR(sum(history, 'amount'))}.`,
        history.slice(0, 10).map(paymentItem),
      )
    },
  },
  {
    roles: [ROLES.CUSTOMER],
    matches: (question) => /invoice|bill/.test(question),
    answer: (context) => {
      if (context.invoices.length === 0) return reply('You do not have any invoices yet.')
      const invoices = [...context.invoices].sort(newestFirst('issueDate'))
      return reply(
        `You have ${plural(invoices.length, 'invoice')} on record.`,
        invoices
          .slice(0, 8)
          .map((invoice) =>
            invoiceItem(invoice, `${invoice.status} · due ${formatDate(invoice.dueDate)}`, formatINR(invoice.total)),
          ),
      )
    },
  },
]
