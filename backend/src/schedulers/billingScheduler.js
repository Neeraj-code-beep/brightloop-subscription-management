import cron from 'node-cron';
import { billingQueue } from '../queues/billingQueue.js';

export function initializeSchedulers() {
  // Run daily at midnight: enqueue recurring billing task
  const task = cron.schedule('0 0 * * *', async () => {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[Scheduler] Triggering midnight recurring billing cycle job for ${today}...`);
    try {
      await billingQueue.add(
        'generate-recurring-invoices',
        {
          triggeredAt: new Date().toISOString(),
          asOfDate: new Date().toISOString()
        },
        {
          jobId: `recurring-billing-${today}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: 100,
          removeOnFail: 500
        }
      );
    } catch (error) {
      console.error('[Scheduler] Failed to enqueue recurring invoice job:', error.message);
    }
  }, {
    scheduled: false
  });

  return {
    start: () => task.start(),
    stop: () => task.stop()
  };
}
