import { Worker } from 'bullmq';
import { getRedisConnection } from '../queues/billingQueue.js';
import { billingService } from '../modules/invoices/billing.service.js';

export function startBillingWorker() {
  const worker = new Worker(
    'billing-queue',
    async (job) => {
      console.log(`[Billing Worker] Processing job ${job.id} (${job.name})...`);
      const asOfDate = job.data?.asOfDate ? new Date(job.data.asOfDate) : new Date();

      switch (job.name) {
        case 'generate-recurring-invoices': {
          console.log(`[Billing Worker] Running automated recurring billing cycle as of ${asOfDate.toISOString()}...`);
          const billingResults = await billingService.generateRecurringInvoices(asOfDate);
          const overdueResults = await billingService.checkAndUpdateOverdueInvoices(asOfDate);

          return {
            status: 'completed',
            billing: billingResults,
            overdue: overdueResults
          };
        }

        case 'process-subscription-renewal': {
          const subId = job.data?.subscriptionId;
          if (!subId) {
            throw new Error('Subscription ID is required for process-subscription-renewal job');
          }
          console.log(`[Billing Worker] Processing renewal for subscription ${subId}...`);
          const result = await billingService.generateSubscriptionInvoice(subId, asOfDate);
          return {
            status: 'completed',
            invoiceNumber: result.invoice?.invoiceNumber,
            isDuplicate: result.isDuplicate
          };
        }

        case 'check-overdue-invoices': {
          console.log(`[Billing Worker] Checking overdue invoices as of ${asOfDate.toISOString()}...`);
          const overdue = await billingService.checkAndUpdateOverdueInvoices(asOfDate);
          return {
            status: 'completed',
            overdue
          };
        }

        default:
          console.warn(`[Billing Worker] Unknown job name: ${job.name}`);
          return { status: 'ignored' };
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Billing Worker] Job ${job.id} (${job.name}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Billing Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
}
