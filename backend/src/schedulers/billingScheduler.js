import cron from 'node-cron';
import { billingQueue } from '../queues/billingQueue.js';

export function initializeSchedulers() {
  // Run daily at midnight: enqueue recurring billing task
  const task = cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Triggering midnight recurring billing cycle job...');
    try {
      await billingQueue.add('generate-recurring-invoices', {
        triggeredAt: new Date().toISOString()
      });
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

