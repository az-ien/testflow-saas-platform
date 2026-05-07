import { Queue } from 'bullmq';
import { bullMQConnection } from '../config/redis';
import { logger } from '../config/logger';

export const runQueue = new Queue('test-runs', {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

runQueue.on('error', (err) => {
  logger.error('Run queue error:', err);
});

logger.info('📬 BullMQ run queue initialized');

export default runQueue;
