import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from '../config/database';
import { bullMQConnection, connectRedis } from '../config/redis';
import { logger } from '../config/logger';
import { AI_QUEUE_NAME, AiWorkflowJobData } from '../orchestration/queues';
import { processAiJob } from './processors';
import '../models';

const CONCURRENCY = parseInt(process.env.AI_WORKER_CONCURRENCY || '2', 10);

const worker = new Worker<AiWorkflowJobData>(
  AI_QUEUE_NAME,
  async (job: Job<AiWorkflowJobData>) => {
    logger.info(`AI job ${job.id} ${job.data.jobName} started`, {
      projectId: job.data.projectId,
      correlationId: job.data.correlationId,
    });
    await processAiJob(job);
  },
  {
    connection: bullMQConnection,
    concurrency: CONCURRENCY,
  }
);

worker.on('completed', (job) => logger.info(`AI job ${job.id} completed`));
worker.on('failed', (job, err) => logger.error(`AI job ${job?.id} failed:`, err));
worker.on('error', (err) => logger.error('AI worker error:', err));

const start = async () => {
  await connectDatabase();
  await connectRedis();
  logger.info(`🧠 AI worker started (concurrency: ${CONCURRENCY})`);
};

start().catch((err) => {
  logger.error('AI worker failed to start:', err);
  process.exit(1);
});

export default worker;
