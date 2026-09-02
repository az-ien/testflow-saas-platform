import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Project } from '../models/Project';
import { runQueue } from '../services/RunQueue';
import { logger } from '../config/logger';

const router = Router();

// POST /api/webhooks/github — GitHub push/PR webhook to auto-trigger runs
router.post('/github', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;

    // Find project by repo URL match
    const repoUrl = req.body?.repository?.clone_url || req.body?.repository?.html_url;
    if (!repoUrl) { res.status(400).json({ error: 'Missing repository URL' }); return; }

    const project = await Project.findOne({ where: { repoUrl } });
    if (!project) { res.status(404).json({ error: 'No project linked to this repo' }); return; }

    // Verify webhook signature
    if (project.webhookSecret && signature) {
      const expected = `sha256=${crypto
        .createHmac('sha256', project.webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex')}`;
      if (signature !== expected) {
        res.status(401).json({ error: 'Invalid webhook signature' }); return;
      }
    }

    // Only act on push/PR events
    if (!['push', 'pull_request'].includes(event)) {
      res.json({ message: `Ignoring event: ${event}` }); return;
    }

    const branch = req.body?.ref?.replace('refs/heads/', '') || req.body?.pull_request?.head?.ref;
    const commitSha = req.body?.after || req.body?.pull_request?.head?.sha;

    const run = await (await import('../models/TestRun')).TestRun.create({
      projectId: project.id,
      userId: project.userId,
      status: 'queued',
      branch,
      commitSha,
      framework: project.framework,
      testPattern: project.testPattern,
      triggeredBy: 'webhook',
      queuedAt: new Date(),
    });

    await runQueue.add('execute-test-run', {
      runId: run.id,
      projectId: project.id,
      userId: project.userId,
      repoUrl: project.repoUrl,
      repoBranch: branch,
      repoAccessToken: project.repoAccessToken,
      repoProvider: project.repoProvider,
      framework: project.framework,
      testPattern: project.testPattern,
      environmentVariables: project.environmentVariables,
      webhookUrl: project.webhookUrl,
      webhookSecret: project.webhookSecret,
    });

    logger.info(`GitHub webhook triggered run ${run.id} for project ${project.id}`);
    res.json({ message: 'Run queued via webhook', runId: run.id });
  } catch (err) { next(err); }
});

const queueFromWebhook = async (project: Project, branch?: string, commitSha?: string) => {
  const run = await (await import('../models/TestRun')).TestRun.create({
    projectId: project.id,
    userId: project.userId,
    status: 'queued',
    branch,
    commitSha,
    framework: project.framework,
    testPattern: project.testPattern,
    triggeredBy: 'webhook',
    queuedAt: new Date(),
  });
  await runQueue.add('execute-test-run', {
    runId: run.id,
    projectId: project.id,
    userId: project.userId,
    repoUrl: project.repoUrl,
    repoBranch: branch,
    repoAccessToken: project.repoAccessToken,
    repoProvider: project.repoProvider,
    framework: project.framework,
    testPattern: project.testPattern,
    environmentVariables: project.environmentVariables,
    webhookUrl: project.webhookUrl,
    webhookSecret: project.webhookSecret,
  });
  return run;
};

router.post('/gitlab', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.FEATURE_GITLAB_WEBHOOKS === 'false') {
      res.status(404).json({ error: 'GitLab webhooks disabled' });
      return;
    }
    const token = req.headers['x-gitlab-token'];
    const repoUrl = req.body?.project?.git_http_url || req.body?.repository?.homepage;
    if (!repoUrl) { res.status(400).json({ error: 'Missing repository URL' }); return; }
    const project = await Project.findOne({ where: { repoUrl } });
    if (!project) { res.status(404).json({ error: 'No project linked to this repo' }); return; }
    if (project.webhookSecret && token !== project.webhookSecret) {
      res.status(401).json({ error: 'Invalid webhook token' }); return;
    }
    const run = await queueFromWebhook(
      project,
      req.body?.ref?.replace('refs/heads/', ''),
      req.body?.checkout_sha || req.body?.after
    );
    res.json({ message: 'Run queued via GitLab webhook', runId: run.id });
  } catch (err) { next(err); }
});

router.post('/bitbucket', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repoUrl = req.body?.repository?.links?.html?.href;
    if (!repoUrl) { res.status(400).json({ error: 'Missing repository URL' }); return; }
    const project = await Project.findOne({ where: { repoUrl } });
    if (!project) { res.status(404).json({ error: 'No project linked to this repo' }); return; }
    const run = await queueFromWebhook(
      project,
      req.body?.push?.changes?.[0]?.new?.name,
      req.body?.push?.changes?.[0]?.new?.target?.hash
    );
    res.json({ message: 'Run queued via Bitbucket webhook', runId: run.id });
  } catch (err) { next(err); }
});

router.post('/azure-devops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repoUrl = req.body?.resource?.repository?.remoteUrl || req.body?.resource?.repository?.url;
    if (!repoUrl) { res.status(400).json({ error: 'Missing repository URL' }); return; }
    const project = await Project.findOne({ where: { repoUrl } });
    if (!project) { res.status(404).json({ error: 'No project linked to this repo' }); return; }
    const run = await queueFromWebhook(
      project,
      req.body?.resource?.refUpdates?.[0]?.name?.replace('refs/heads/', ''),
      req.body?.resource?.refUpdates?.[0]?.newObjectId
    );
    res.json({ message: 'Run queued via Azure DevOps webhook', runId: run.id });
  } catch (err) { next(err); }
});

export default router;
