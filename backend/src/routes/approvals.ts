import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { authenticate } from '../middleware/auth';
import { TestPlan } from '../models/TestPlan';
import { Scenario } from '../models/Scenario';
import { Approval } from '../models/Approval';
import { HealingAttempt } from '../models/HealingAttempt';
import { Project } from '../models/Project';
import { assertOwned } from '../services/projectAccess';
import { orchestrator } from '../orchestration/WorkflowOrchestrator';
import { recordActivity } from '../services/AiAudit';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await TestPlan.findAll({
      where: { userId: req.user!.userId, status: 'awaiting_approval' },
      include: [
        { association: 'requirement', attributes: ['id', 'key', 'title'] },
        { association: 'scenarios' },
        { association: 'project', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    const healing = await HealingAttempt.findAll({
      where: { userId: req.user!.userId, status: 'awaiting_approval' },
      include: [{ association: 'project', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ testPlans: plans, healingAttempts: healing });
  } catch (err) { next(err); }
});

router.post(
  '/plans/:id',
  [
    body('decision').isIn(['approved', 'rejected', 'changes_requested']),
    body('scope').optional().isIn(['verified', 'selected', 'all']),
    body('scenarioIds').optional().isArray(),
    body('comment').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await TestPlan.findByPk(req.params.id);
      assertOwned(plan, req.user!.userId, 'Test plan');
      if (plan!.status !== 'awaiting_approval') {
        throw new ValidationError('This plan is not waiting for approval');
      }

      const scope = req.body.scope || 'verified';
      const where: Record<string, unknown> = {
        testPlanId: plan!.id,
        userId: req.user!.userId,
        classification: { [Op.ne]: 'UNSUPPORTED' },
      };
      if (scope === 'verified') where.classification = 'VERIFIED';
      if (scope === 'selected' && req.body.scenarioIds?.length) where.id = req.body.scenarioIds;

      if (req.body.decision === 'approved') {
        await Scenario.update({ status: 'approved' }, { where });
        await Scenario.update(
          { status: 'rejected' },
          { where: { testPlanId: plan!.id, userId: req.user!.userId, classification: 'UNSUPPORTED' } }
        );
      } else if (req.body.decision === 'rejected') {
        await Scenario.update({ status: 'rejected' }, { where: { testPlanId: plan!.id, userId: req.user!.userId } });
      }

      await Approval.create({
        projectId: plan!.projectId,
        userId: req.user!.userId,
        testPlanId: plan!.id,
        decision: req.body.decision,
        scope,
        comment: req.body.comment || null,
      });

      if (req.body.decision === 'approved') {
        const project = await Project.findByPk(plan!.projectId);
        await plan!.update({ status: project?.autoGenerateOnApprove === false ? 'approved' : 'approved' });
        if (project?.autoGenerateOnApprove !== false) {
          await orchestrator.enqueue({
            jobName: 'GENERATE_TEST',
            projectId: plan!.projectId,
            userId: req.user!.userId,
            correlationId: plan!.correlationId,
            testPlanId: plan!.id,
            requirementId: plan!.requirementId,
            entityType: 'test_plan',
            entityId: plan!.id,
          });
        }
      } else {
        await plan!.update({ status: 'cancelled' });
      }

      await recordActivity({
        projectId: plan!.projectId,
        userId: req.user!.userId,
        action: 'plan_approval',
        actor: 'user',
        entityType: 'test_plan',
        entityId: plan!.id,
        details: { decision: req.body.decision, scope },
      });

      res.json({ message: 'Approval recorded', testPlanId: plan!.id, decision: req.body.decision });
    } catch (err) { next(err); }
  }
);

router.post(
  '/scenarios/:id',
  [body('decision').isIn(['approved', 'rejected'])],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await Scenario.findByPk(req.params.id);
      assertOwned(scenario, req.user!.userId, 'Scenario');
      if (scenario!.classification === 'UNSUPPORTED' && req.body.decision === 'approved') {
        throw new ValidationError('Unsupported scenarios cannot be approved for generation');
      }
      await scenario!.update({ status: req.body.decision === 'approved' ? 'approved' : 'rejected' });
      await Approval.create({
        projectId: scenario!.projectId,
        userId: req.user!.userId,
        testPlanId: scenario!.testPlanId,
        scenarioId: scenario!.id,
        decision: req.body.decision,
        scope: 'selected',
      });
      res.json(scenario);
    } catch (err) { next(err); }
  }
);

router.post(
  '/healing/:id',
  [body('decision').isIn(['approved', 'rejected'])],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attempt = await HealingAttempt.findByPk(req.params.id);
      assertOwned(attempt, req.user!.userId, 'Healing attempt');
      await Approval.create({
        projectId: attempt!.projectId,
        userId: req.user!.userId,
        healingAttemptId: attempt!.id,
        decision: req.body.decision,
        scope: 'healing',
        comment: req.body.comment || null,
      });
      if (req.body.decision === 'rejected') {
        await attempt!.update({ status: 'rejected' });
        res.json({ message: 'Healing rejected' });
        return;
      }
      await attempt!.update({ status: 'approved' });
      await orchestrator.enqueue({
        jobName: 'HEAL_TEST',
        projectId: attempt!.projectId,
        userId: req.user!.userId,
        healingAttemptId: attempt!.id,
        testRunId: attempt!.testRunId,
        entityType: 'healing_attempt',
        entityId: attempt!.id,
      });
      res.json({ message: 'Healing approved and queued' });
    } catch (err) { next(err); }
  }
);

export default router;
