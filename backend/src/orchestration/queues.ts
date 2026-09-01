import { Queue } from 'bullmq';
import { bullMQConnection } from '../config/redis';
import { logger } from '../config/logger';
import { AiJobName } from '../ai/types';

export interface AiWorkflowJobData {
  workflowJobId: string;
  jobName: AiJobName;
  projectId: string;
  userId: string;
  correlationId: string;
  testPlanId?: string;
  requirementId?: string;
  scenarioIds?: string[];
  generatedTestId?: string;
  testRunId?: string;
  healingAttemptId?: string;
}

export const AI_QUEUE_NAME = 'ai-workflow';

export const aiQueue = new Queue<AiWorkflowJobData>(AI_QUEUE_NAME, {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 8000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

aiQueue.on('error', (err) => {
  logger.error('AI workflow queue error:', err);
});

logger.info('📬 BullMQ AI workflow queue initialized');

export default aiQueue;
