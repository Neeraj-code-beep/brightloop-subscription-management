import { ROLES } from './roles.js'

export const AI_SUBTITLES = {
  [ROLES.ADMIN]: 'Billing intelligence',
  [ROLES.STAFF]: 'Billing operations assistant',
  [ROLES.CUSTOMER]: 'Your subscription assistant',
}

export const AI_SUGGESTED_PROMPTS = {
  [ROLES.ADMIN]: [
    'Which invoices are overdue?',
    'How much is outstanding?',
    'What is our MRR?',
    'Tell me about Priya Sharma.',
  ],
  [ROLES.STAFF]: [
    'Which invoices are overdue?',
    'How much is outstanding?',
    "Show today's payments.",
    'Has Priya Sharma paid her invoice?',
  ],
  [ROLES.CUSTOMER]: [
    'What is my current plan?',
    'When is my next payment due?',
    'Do I have any outstanding invoices?',
    'Show my payment history.',
  ],
}
