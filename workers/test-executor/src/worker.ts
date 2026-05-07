import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

import { bullMQConnection } from './config/redis';
import { connectDatabase } from './config/database';
import { TestRun } from './models/TestRun';
import { TestExecutor } from './TestExecutor';
import { WebhookNotifier } from './WebhookNotifier';
import { logger } from './config/logger';

const QUEUE_NAME = 'test-runs';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

export interface RunJobData {
  runId: string;
  projectId: string;
  userId: string;
  repoUrl: string;
  repoBranch: string;
  repoAccessToken?: string;
  repoProvider: string;
  framework: string;
  testPattern?: string;
  environmentVariables?: Record<string, string>;
  webhookUrl?: string;
  webhookSecret?: string;
}

const worker = new Worker<RunJobData>(
  QUEUE_NAME,
  async (job: Job<RunJobData>) => {
    const { runId, webhookUrl, webhookSecret } = job.data;
    const run = await TestRun.findByPk(runId);
    if (!run) {
      logger.error(`Run ${runId} not found — skipping`);
      return;
    }

    const notifier = new WebhookNotifier(webhookUrl, webhookSecret);
    const executor = new TestExecutor(job.data);

    try {
      // ── Cloning ──────────────────────────────────────────────────────
      await run.update({ status: 'cloning', startedAt: new Date() });
      await notifier.notify('run.started', { runId, status: 'cloning' });
      await executor.cloneRepo();

      // ── Installing deps ──────────────────────────────────────────────
      await run.update({ status: 'installing' });
      await notifier.notify('run.status', { runId, status: 'installing' });
      await executor.installDependencies();

      // ── Running tests ─────────────────────────────────────────────────
      await run.update({ status: 'running' });
      await notifier.notify('run.status', { runId, status: 'running' });
      const results = await executor.runTests();

      // ── Persist results ───────────────────────────────────────────────
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - run.startedAt!.getTime();
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const finalStatus = failed > 0 ? 'failed' : 'passed';

      await run.update({
        status: finalStatus,
        results,
        summary: { total: results.length, passed, failed, skipped, duration: durationMs },
        logs: executor.getLogs(),
        reportUrl: await executor.uploadReport(),
        completedAt,
        durationMs,
      });

      await notifier.notify('run.completed', {
        runId,
        status: finalStatus,
        summary: { total: results.length, passed, failed, skipped },
        reportUrl: run.reportUrl,
      });

      logger.info(`✅ Run ${runId} completed: ${finalStatus} (${passed}/${results.length} passed)`);

    } catch (err: any) {
      logger.error(`❌ Run ${runId} failed with error:`, err);
      await run.update({
        status: 'error',
        logs: [...(run.logs || []), `FATAL: ${err.message}`],
        completedAt: new Date(),
        durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : 0,
      });
      await notifier.notify('run.error', { runId, error: err.message });
      throw err; // BullMQ will retry
    } finally {
      await executor.cleanup();
    }
  },
  {
    connection: bullMQConnection,
    concurrency: CONCURRENCY,
    limiter: { max: 10, duration: 60000 }, // max 10 jobs/min
  }
);

worker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
worker.on('failed', (job, err) => logger.error(`Job ${job?.id} failed:`, err));
worker.on('error', (err) => logger.error('Worker error:', err));

// Bootstrap
const start = async () => {
  await connectDatabase();
  logger.info(`🔧 Test executor worker started (concurrency: ${CONCURRENCY})`);
};

start().catch((err) => {
  logger.error('Worker failed to start:', err);
  process.exit(1);
});

export default worker;
