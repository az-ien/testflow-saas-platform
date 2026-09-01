import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { HealingAttempt } from '../models/HealingAttempt';
import { TestRun } from '../models/TestRun';
import { assertOwned } from '../services/projectAccess';
import { orchestrator } from '../orchestration/WorkflowOrchestrator';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    const attempts = await HealingAttempt.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'project', attributes: ['id', 'name'] },
        { association: 'testRun', attributes: ['id', 'status', 'summary'] },
        { association: 'generatedTest', attributes: ['id', 'status'] },
      ],
    });
    res.json({ healingAttempts: attempts, total: attempts.length });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await HealingAttempt.findByPk(req.params.id, {
      include: [{ association: 'testRun' }, { association: 'generatedTest' }, { association: 'scenario' }],
    });
    assertOwned(attempt, req.user!.userId, 'Healing attempt');
    res.json(attempt);
  } catch (err) { next(err); }
});

router.post('/from-run/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await TestRun.findByPk(req.params.runId);
    assertOwned(run, req.user!.userId, 'Test run');
    await orchestrator.enqueue({
      jobName: 'ANALYZE_FAILURE',
      projectId: run!.projectId,
      userId: req.user!.userId,
      testRunId: run!.id,
      generatedTestId: run!.generatedTestId || undefined,
      correlationId: run!.correlationId || undefined,
      entityType: 'test_run',
      entityId: run!.id,
    });
    res.status(202).json({ message: 'Failure analysis queued' });
  } catch (err) { next(err); }
});

export default router;
