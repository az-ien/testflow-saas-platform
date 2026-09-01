import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { Scenario } from '../models/Scenario';
import { assertOwned } from '../services/projectAccess';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    if (req.query.testPlanId) where.testPlanId = req.query.testPlanId;
    if (req.query.classification) where.classification = req.query.classification;
    if (req.query.status) where.status = req.query.status;
    const scenarios = await Scenario.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'requirement', attributes: ['id', 'key', 'title'] },
        { association: 'testPlan', attributes: ['id', 'status'] },
        { association: 'validation' },
        { association: 'evidence' },
        { association: 'project', attributes: ['id', 'name'] },
      ],
    });
    res.json({ scenarios, total: scenarios.length });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenario = await Scenario.findByPk(req.params.id, {
      include: [
        { association: 'requirement' },
        { association: 'testPlan' },
        { association: 'validation' },
        { association: 'evidence' },
        { association: 'generatedTests' },
      ],
    });
    assertOwned(scenario, req.user!.userId, 'Scenario');
    res.json(scenario);
  } catch (err) { next(err); }
});

export default router;
