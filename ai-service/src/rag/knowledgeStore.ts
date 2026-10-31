/**
 * Brightloop Subscription Management System — Knowledge Store
 * 
 * IMPORTANT ARCHITECTURAL & POLICY NOTICE:
 * 1. Hardcoded policies must NEVER be represented as official company policies.
 * 2. DEMO_POLICY_FIXTURES are strictly for unit testing, algorithm evaluation, and developer demonstration.
 * 3. Authoritative company policies must be ingested through an authorized document management workflow.
 */

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'CANCELLATION' | 'REFUND' | 'BILLING_TERMS' | 'SLA';
  sections: Array<{
    heading: string;
    content: string;
    citation: string;
  }>;
  allowedRoles: ('ADMIN' | 'STAFF' | 'CUSTOMER')[];
  lastUpdated: string;
  isDemoFixture: boolean;
  disclaimer?: string;
}

/**
 * Labeled demo/test fixtures. Strictly NOT authoritative company policy.
 */
export const DEMO_POLICY_FIXTURES: KnowledgeDocument[] = [
  {
    id: 'demo_cancellation_policy',
    title: '[DEMO FIXTURE] Example Subscription Cancellation Guidelines',
    category: 'CANCELLATION',
    allowedRoles: ['ADMIN', 'STAFF', 'CUSTOMER'],
    lastUpdated: '2026-10-01',
    isDemoFixture: true,
    disclaimer: '[DEMO / TEST FIXTURE ONLY - NOT AN AUTHORITATIVE COMPANY POLICY]',
    sections: [
      {
        heading: 'Example Cancellation at Period End',
        content:
          '[DEMO FIXTURE] Customers may request cancellation via the portal. In this example fixture, cancellations take effect at the end of the current billing cycle until currentPeriodEnd.',
        citation: 'Demo Agreement Example Section 4.1'
      },
      {
        heading: 'Example Immediate Cancellation & Proration',
        content:
          '[DEMO FIXTURE] Immediate cancellation terminates access upon request. In this test fixture, mid-cycle prorated refunds are disallowed unless within the 14-day window.',
        citation: 'Demo Agreement Example Section 4.2'
      }
    ]
  },
  {
    id: 'demo_refund_policy',
    title: '[DEMO FIXTURE] Example Refund & SLA Credit Policy',
    category: 'REFUND',
    allowedRoles: ['ADMIN', 'STAFF', 'CUSTOMER'],
    lastUpdated: '2026-10-01',
    isDemoFixture: true,
    disclaimer: '[DEMO / TEST FIXTURE ONLY - NOT AN AUTHORITATIVE COMPANY POLICY]',
    sections: [
      {
        heading: 'Example 14-Day Initial Satisfaction Window',
        content:
          '[DEMO FIXTURE] New subscribers are eligible for a 100% refund of initial subscription charges if requested within 14 calendar days of initial sign-up.',
        citation: 'Demo Refund Policy Example Section 1.1'
      },
      {
        heading: 'Example SLA Uptime Credit Rules',
        content:
          '[DEMO FIXTURE] Availability under 99.9% qualifies for a 10% invoice credit against the subsequent renewal cycle upon filing a support ticket.',
        citation: 'Demo SLA Example Schedule B'
      }
    ]
  },
  {
    id: 'demo_enterprise_terms',
    title: '[DEMO FIXTURE] Example Enterprise Net-30 Payment Terms',
    category: 'SLA',
    allowedRoles: ['ADMIN', 'STAFF'], // Restricted from CUSTOMER role
    lastUpdated: '2026-10-01',
    isDemoFixture: true,
    disclaimer: '[DEMO / TEST FIXTURE ONLY - NOT AN AUTHORITATIVE COMPANY POLICY]',
    sections: [
      {
        heading: 'Example Net-30 Invoicing Window',
        content:
          '[DEMO FIXTURE] Approved enterprise accounts receive Net-30 invoice terms. Invoices become past due 30 calendar days following generation.',
        citation: 'Demo Enterprise Terms Example Addendum C'
      }
    ]
  },
  {
    id: 'demo_executive_margins',
    title: '[DEMO FIXTURE] Executive Financial Margins & Target Metrics',
    category: 'BILLING_TERMS',
    allowedRoles: ['ADMIN'], // Restricted from CUSTOMER and STAFF
    lastUpdated: '2026-10-01',
    isDemoFixture: true,
    disclaimer: '[DEMO / TEST FIXTURE ONLY - NOT AN AUTHORITATIVE COMPANY POLICY]',
    sections: [
      {
        heading: 'Executive Financial Margin Targets',
        content:
          '[DEMO FIXTURE] Executive target gross margin for Enterprise SaaS subscriptions is 82% with customer payback period under 8 months.',
        citation: 'Demo Executive Guidelines Example Section 9'
      }
    ]
  }
];

/**
 * Authoritative verified company documents index.
 * In production, documents are loaded only when officially approved and indexed.
 */
export const VERIFIED_COMPANY_DOCUMENTS: KnowledgeDocument[] = [];

export function registerVerifiedDocument(doc: KnowledgeDocument): void {
  doc.isDemoFixture = false;
  VERIFIED_COMPANY_DOCUMENTS.push(doc);
}

export function clearVerifiedDocuments(): void {
  VERIFIED_COMPANY_DOCUMENTS.length = 0;
}
