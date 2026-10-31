export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    productName: 'Brightloop Starter Platform',
    prices: { Monthly: 9999, Quarterly: 28997, Yearly: 99990 },
    benefits: ['Up to 5 active subscriptions', 'Standard invoicing', 'Email payment reminders'],
  },
  {
    id: 'growth',
    name: 'Growth',
    productName: 'Brightloop Growth Platform',
    prices: { Monthly: 14999, Quarterly: 43497, Yearly: 149990 },
    benefits: [
      'Up to 25 active subscriptions',
      'Automated renewals and reminders',
      'UPI, cards and net banking',
      'Priority email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    productName: 'Brightloop Business Platform',
    prices: { Monthly: 24999, Quarterly: 72497, Yearly: 249990 },
    benefits: [
      'Up to 150 active subscriptions',
      'Custom discounts and tax rules',
      'Revenue reports and exports',
      'Dedicated onboarding call',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    productName: 'Brightloop Enterprise Platform',
    prices: { Monthly: 45000, Quarterly: 130500, Yearly: 480000 },
    benefits: [
      'Unlimited active subscriptions',
      'Multi-entity billing',
      'API access and webhooks',
      'Named success manager',
    ],
  },
]

export function getPlanById(planId) {
  return PLANS.find((plan) => plan.id === planId)
}
