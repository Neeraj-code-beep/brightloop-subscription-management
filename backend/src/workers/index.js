import { startBillingWorker } from './billingWorker.js';

console.log('[Worker Process] Starting background workers for SMS...');
try {
  startBillingWorker();
  console.log('[Worker Process] Billing worker is running and listening for jobs.');
} catch (error) {
  console.error('[Worker Process] Failed to start worker:', error);
  process.exit(1);
}

