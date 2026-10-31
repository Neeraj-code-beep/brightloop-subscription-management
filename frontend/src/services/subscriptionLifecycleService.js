import { REFERENCE_DATE } from '../constants/subscriptions.js'

export const LIFECYCLE_ACTIONS = {
  CREATE_QUOTATION: 'createQuotation',
  RETURN_TO_DRAFT: 'returnToDraft',
  CONFIRM: 'confirm',
  ACTIVATE: 'activate',
  PAUSE: 'pause',
  RESUME: 'resume',
  RENEW: 'renew',
  CLOSE: 'close',
}

const ACTION_RULES = {
  [LIFECYCLE_ACTIONS.CREATE_QUOTATION]: { from: ['Draft'], message: 'Only a draft can become a quotation.' },
  [LIFECYCLE_ACTIONS.RETURN_TO_DRAFT]: { from: ['Quotation'], message: 'Only a quotation can return to draft.' },
  [LIFECYCLE_ACTIONS.CONFIRM]: { from: ['Quotation'], message: 'Only a quotation can be confirmed.' },
  [LIFECYCLE_ACTIONS.ACTIVATE]: { from: ['Confirmed'], message: 'Only a confirmed subscription can be activated.' },
  [LIFECYCLE_ACTIONS.PAUSE]: { from: ['Active'], message: 'Only an active subscription can be paused.' },
  [LIFECYCLE_ACTIONS.RESUME]: { from: ['Active'], message: 'Only a paused subscription can be resumed.' },
  [LIFECYCLE_ACTIONS.RENEW]: { from: ['Active'], message: 'Only an active subscription can be renewed.' },
  [LIFECYCLE_ACTIONS.CLOSE]: { from: ['Confirmed', 'Active'], message: 'Only a confirmed or active subscription can be closed.' },
}

export function nextQuotationNumber(subscriptions) {
  const sequences = subscriptions
    .filter((subscription) => subscription.quotationNumber)
    .map((subscription) => Number(subscription.quotationNumber.split('-').pop()))
  const highest = Math.max(0, ...sequences)
  return `QT-${REFERENCE_DATE.slice(0, 4)}-${String(highest + 1).padStart(4, '0')}`
}

export function canGenerateInvoice(subscription) {
  return ['Confirmed', 'Active'].includes(subscription.status) && !subscription.paused
}

export function getAvailableActions(subscription) {
  return Object.fromEntries(
    Object.entries(ACTION_RULES).map(([action, rule]) => {
      const allowed = rule.from.includes(subscription.status) && isActionState(action, subscription)
      return [action, allowed]
    }),
  )
}

function isActionState(action, subscription) {
  if (action === LIFECYCLE_ACTIONS.RESUME) return subscription.paused
  if (action === LIFECYCLE_ACTIONS.PAUSE) return !subscription.paused
  return true
}

export function validateRenewalExpiry(subscription, expiryDate) {
  if (!expiryDate) return 'Choose a new expiry date.'
  if (expiryDate <= subscription.expiryDate) return 'The new expiry date must be after the current one.'
  return null
}

function withLifecycleChange(subscription, changes, label) {
  return {
    ...subscription,
    ...changes,
    activity: [
      { id: `${subscription.id}-${subscription.activity.length + 1}`, date: REFERENCE_DATE, label },
      ...subscription.activity,
    ],
  }
}

export function applyLifecycleAction(subscription, action, { subscriptions = [], expiryDate } = {}) {
  const rule = ACTION_RULES[action]
  if (!rule) return { error: 'Unknown lifecycle action.' }
  if (!getAvailableActions(subscription)[action]) return { error: rule.message }

  switch (action) {
    case LIFECYCLE_ACTIONS.CREATE_QUOTATION: {
      const quotationNumber = subscription.quotationNumber ?? nextQuotationNumber(subscriptions)
      return {
        subscription: withLifecycleChange(
          subscription,
          { status: 'Quotation', quotationNumber, quotedOn: REFERENCE_DATE },
          `Quotation ${quotationNumber} created`,
        ),
      }
    }
    case LIFECYCLE_ACTIONS.RETURN_TO_DRAFT:
      return { subscription: withLifecycleChange(subscription, { status: 'Draft' }, 'Returned to draft') }
    case LIFECYCLE_ACTIONS.CONFIRM:
      return { subscription: withLifecycleChange(subscription, { status: 'Confirmed' }, 'Quotation confirmed') }
    case LIFECYCLE_ACTIONS.ACTIVATE:
      return { subscription: withLifecycleChange(subscription, { status: 'Active' }, 'Subscription activated') }
    case LIFECYCLE_ACTIONS.PAUSE:
      return { subscription: withLifecycleChange(subscription, { paused: true }, 'Subscription paused') }
    case LIFECYCLE_ACTIONS.RESUME:
      return { subscription: withLifecycleChange(subscription, { paused: false }, 'Subscription resumed') }
    case LIFECYCLE_ACTIONS.RENEW: {
      const validationError = validateRenewalExpiry(subscription, expiryDate)
      if (validationError) return { error: validationError }
      return {
        subscription: withLifecycleChange(
          subscription,
          { expiryDate },
          `Subscription renewed until ${expiryDate}`,
        ),
      }
    }
    case LIFECYCLE_ACTIONS.CLOSE:
      return {
        subscription: withLifecycleChange(
          subscription,
          { status: 'Closed', paused: false, autoRenew: false, nextBillingDate: null, closedOn: REFERENCE_DATE },
          'Subscription closed',
        ),
      }
    default:
      return { error: 'Unknown lifecycle action.' }
  }
}
