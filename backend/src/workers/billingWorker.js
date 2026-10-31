import { Worker } from 'bullmq';
import { getRedisConnection } from '../queues/billingQueue.js';

export function startBillingWorker() {
  const worker = new Worker(
    'billing-queue',
    async (job) => {
      console.log(`[Worker] Processing job ${job.id} of type: ${job.name}`);
      switch (job.name) {
        case 'generate-recurring-invoices':
          // Scaffold: Business logic to run recurring invoice generation
          console.log('[Worker] Running automated recurring invoice cycle...');
          return { status: 'completed', processed: 0 };
        case 'process-subscription-renewal':
          // Scaffold: Renew single subscription
          console.log(`[Worker] Processing renewal for subscription ${job.data?.subscriptionId}`);
          return { status: 'completed' };
        default:
          console.warn(`[Worker] Unknown job name: ${job.name}`);
          return { status: 'ignored' };
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
}

