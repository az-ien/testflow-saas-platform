import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { Requirement } from '../models/Requirement';
import { TestPlan } from '../models/TestPlan';
import { ScenarioEvidence } from '../models/ScenarioEvidence';
import { getOwnedProject, assertOwned } from '../services/projectAccess';
import { assertUsageAvailable, incrementUsage } from '../services/UsageMeter';
import { orchestrator } from '../orchestration/WorkflowOrchestrator';
import { recordActivity } from '../services/AiAudit';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    const plans = await TestPlan.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'requirement', attributes: ['id', 'key', 'title'] },
        { association: 'project', attributes: ['id', 'name'] },
      ],
    });
    res.json({ testPlans: plans, total: plans.length });
  } catch (err) { next(err); }
});

router.post(
  '/',
  [body('requirementId').isUUID(), body('applicationUrl').optional().isURL()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requirement = await Requirement.findByPk(req.body.requirementId);
      assertOwned(requirement, req.user!.userId, 'Requirement');
      const project = await getOwnedProject(requirement!.projectId, req.user!.userId);
      await assertUsageAvailable(req.user!.userId, 'planning');

      const correlationId = uuidv4();
      const plan = await TestPlan.create({
        projectId: project.id,
        userId: req.user!.userId,
        requirementId: requirement!.id,
        status: 'queued',
        correlationId,
        applicationUrl: req.body.applicationUrl || project.applicationUrl || null,
      });

      await incrementUsage(req.user!.userId, 'planning');
      await orchestrator.enqueue({
        jobName: 'EXPLORE_APPLICATION',
        projectId: project.id,
        userId: req.user!.userId,
        correlationId,
        testPlanId: plan.id,
        requirementId: requirement!.id,
        entityType: 'test_plan',
        entityId: plan.id,
      });

      await recordActivity({
        projectId: project.id,
        userId: req.user!.userId,
        action: 'plan_started',
        actor: 'user',
        entityType: 'test_plan',
        entityId: plan.id,
        correlationId,
      });

      res.status(202).json({
        message: 'AI planning workflow queued',
        testPlanId: plan.id,
        correlationId,
        status: plan.status,
      });
    } catch (err) { next(err); }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await TestPlan.findByPk(req.params.id, {
      include: [
        { association: 'requirement' },
        { association: 'project', attributes: ['id', 'name', 'applicationUrl', 'framework', 'approvalPolicy'] },
        { association: 'scenarios', include: [{ association: 'validation' }, { association: 'evidence' }] },
      ],
    });
    assertOwned(plan, req.user!.userId, 'Test plan');
    const evidence = await ScenarioEvidence.findAll({
      where: { testPlanId: plan!.id, userId: req.user!.userId },
      order: [['createdAt', 'ASC']],
    });
    res.json({ ...plan!.toJSON(), evidence });
  } catch (err) { next(err); }
});

export default router;
