export const PRODUCTS = [
  { id: 'brightloop-core', name: 'Brightloop Core', type: 'Software', planIds: ['starter', 'growth', 'business'] },
  { id: 'brightloop-enterprise', name: 'Brightloop Enterprise', type: 'Software', planIds: ['enterprise'] },
]

export const PLAN_OFFER_SETTINGS = {
  starter: { status: 'Active', costPrice: null, minQuantity: 1, availabilityStart: null, availabilityEnd: null },
  growth: { status: 'Active', costPrice: null, minQuantity: 1, availabilityStart: null, availabilityEnd: null },
  business: { status: 'Active', costPrice: null, minQuantity: 1, availabilityStart: null, availabilityEnd: null },
  enterprise: { status: 'Active', costPrice: null, minQuantity: 1, availabilityStart: null, availabilityEnd: null },
}
