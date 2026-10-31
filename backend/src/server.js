import { app } from './app.js';
import { config } from './config/index.js';
import { initializeSchedulers } from './schedulers/billingScheduler.js';

const server = app.listen(config.port, () => {
  console.log(`[SMS Backend] Server listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[SMS Backend] Health check: http://localhost:${config.port}/health`);

  // Initialize recurring cron schedulers in production/development
  if (config.nodeEnv !== 'test') {
    const scheduler = initializeSchedulers();
    scheduler.start();
    console.log('[SMS Backend] Schedulers initialized');
  }
});

// Graceful Shutdown
const shutdown = (signal) => {
  console.log(`[SMS Backend] Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('[SMS Backend] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

