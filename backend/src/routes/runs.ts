import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { Project } from '../models/Project';
import { TestRun } from '../models/TestRun';
import { User } from '../models/User';
import { NotFoundError, ForbiddenError, PlanLimitError } from '../middleware/errorHandler';
import { runQueue } from '../services/RunQueue';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

// POST /api/runs — Trigger a new test run
router.post(
  '/',
  [
    body('projectId').isUUID(),
    body('branch').optional().trim(),
    body('testPattern').optional().trim(),
    body('triggeredBy').optional().isIn(['api', 'schedule', 'webhook', 'dashboard']),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, branch, testPattern, triggeredBy = 'api' } = req.body;
      const userId = req.user!.userId;

      // Check project ownership
      const project = await Project.findByPk(projectId);
      if (!project) throw new NotFoundError('Project');
      if (project.userId !== userId) throw new ForbiddenError();
      if (!project.isActive) throw new ForbiddenError('Project is inactive');

      // Check plan limits
      const user = await User.findByPk(userId);
      if (user && user.monthlyRunsUsed! >= user.monthlyRunsLimit!) {
        throw new PlanLimitError(
          `Monthly run limit reached (${user.monthlyRunsLimit} runs). Upgrade your plan.`
        );
      }

      // Create run record
      const run = await TestRun.create({
        projectId,
        userId,
        status: 'queued',
        branch: branch || project.repoBranch,
        testPattern: testPattern || project.testPattern,
        framework: project.framework,
        triggeredBy,
        queuedAt: new Date(),
      });

      // Increment usage counter
      await User.increment('monthlyRunsUsed', { by: 1, where: { id: userId } });
      await Project.increment('totalRuns', { by: 1, where: { id: projectId } });
      await Project.update({ lastRunAt: new Date() }, { where: { id: projectId } });

      // Queue the job
      const job = await runQueue.add('execute-test-run', {
        runId: run.id,
        projectId,
        userId,
        repoUrl: project.repoUrl,
        repoBranch: branch || project.repoBranch,
        repoAccessToken: project.repoAccessToken,
        repoProvider: project.repoProvider,
        framework: project.framework,
        testPattern: testPattern || project.testPattern,
        environmentVariables: project.environmentVariables,
        webhookUrl: project.webhookUrl,
        webhookSecret: project.webhookSecret,
      }, {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      await run.update({ workerJobId: job.id?.toString() });

      res.status(202).json({
        message: 'Test run queued successfully',
        runId: run.id,
        jobId: job.id,
        status: 'queued',
        estimatedStart: 'within 30 seconds',
      });
    } catch (err) { next(err); }
  }
);

// GET /api/runs — List runs (with filters)
router.get('/',
  [
    query('projectId').optional().isUUID(),
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const where: any = { userId: req.user!.userId };
      if (req.query.projectId) where.projectId = req.query.projectId;
      if (req.query.status) where.status = req.query.status;

      const { count, rows } = await TestRun.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [{ association: 'project', attributes: ['id', 'name', 'framework'] }],
      });

      res.json({
        runs: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
      });
    } catch (err) { next(err); }
  }
);

// GET /api/runs/:id — Get run details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await TestRun.findByPk(req.params.id, {
      include: [{ association: 'project', attributes: ['id', 'name', 'framework', 'repoUrl'] }],
    });
    if (!run) throw new NotFoundError('Test run');
    if (run.userId !== req.user!.userId) throw new ForbiddenError();
    res.json(run);
  } catch (err) { next(err); }
});

// DELETE /api/runs/:id — Cancel queued run
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await TestRun.findByPk(req.params.id);
    if (!run) throw new NotFoundError('Test run');
    if (run.userId !== req.user!.userId) throw new ForbiddenError();
    if (!['queued', 'cloning', 'installing'].includes(run.status!)) {
      res.status(400).json({ error: 'Only queued runs can be cancelled' });
      return;
    }
    await run.update({ status: 'cancelled', completedAt: new Date() });
    res.json({ message: 'Run cancelled' });
  } catch (err) { next(err); }
});

export default router;
