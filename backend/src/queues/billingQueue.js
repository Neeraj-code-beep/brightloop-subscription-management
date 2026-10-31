import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';

let redisConnection = null;

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      lazyConnect: true
    });
  }
  return redisConnection;
}

export const billingQueue = new Queue('billing-queue', {
  connection: getRedisConnection()
});

