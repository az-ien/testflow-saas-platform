import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { Requirement } from '../models/Requirement';
import { Scenario } from '../models/Scenario';
import { GeneratedTest } from '../models/GeneratedTest';
import { TestRun } from '../models/TestRun';
import { HealingAttempt } from '../models/HealingAttempt';
import { AiActivity } from '../models/AiActivity';
import { TestPlan } from '../models/TestPlan';
import { Project } from '../models/Project';

const router = Router();
router.use(authenticate);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [requirements, scenarios, verified, generated, runs, healing, activities, plans, projects] = await Promise.all([
      Requirement.count({ where: { userId } }),
      Scenario.count({ where: { userId } }),
      Scenario.count({ where: { userId, classification: 'VERIFIED' } }),
      GeneratedTest.count({ where: { userId } }),
      TestRun.findAll({ where: { userId }, attributes: ['status', 'summary', 'createdAt'] }),
      HealingAttempt.count({ where: { userId } }),
      AiActivity.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit: 12 }),
      TestPlan.count({ where: { userId } }),
      Project.count({ where: { userId } }),
    ]);

    const passed = runs.filter((run) => run.status === 'passed').length;
    const failed = runs.filter((run) => run.status === 'failed').length;
    const coverage = requirements
      ? Math.round((await Scenario.count({ where: { userId, status: ['approved', 'generated'] } })) / Math.max(requirements, 1) * 100)
      : 0;

    res.json({
      projects,
      requirements,
      plans,
      scenarios,
      verifiedScenarios: verified,
      generatedTests: generated,
      testRuns: runs.length,
      passed,
      failed,
      passRate: runs.length ? Math.round((passed / runs.length) * 100) : 0,
      healingAttempts: healing,
      coveragePercent: Math.min(coverage, 100),
      recentActivity: activities,
    });
  } catch (err) { next(err); }
});

router.get('/coverage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const requirements = await Requirement.findAll({
      where: { userId },
      include: [
        { association: 'scenarios' },
        { association: 'project', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    const coverage = requirements.map((requirement) => {
      const scenarios = (requirement as any).scenarios || [];
      const verified = scenarios.filter((s: any) => s.classification === 'VERIFIED').length;
      const generated = scenarios.filter((s: any) => s.status === 'generated').length;
      const approved = scenarios.filter((s: any) => s.status === 'approved' || s.status === 'generated').length;
      const unsupported = scenarios.filter((s: any) => s.classification === 'UNSUPPORTED').length;
      const needsReview = scenarios.filter((s: any) => s.classification === 'NEEDS_REVIEW').length;
      return {
        id: requirement.id,
        key: requirement.key,
        title: requirement.title,
        project: (requirement as any).project,
        scenarioCount: scenarios.length,
        verified,
        generated,
        approved,
        unsupported,
        needsReview,
        automationCoverage: scenarios.length ? Math.round((generated / scenarios.length) * 100) : 0,
        status: requirement.status,
      };
    });
    const totals = coverage.reduce(
      (acc, row) => {
        acc.requirements += 1;
        acc.scenarios += row.scenarioCount;
        acc.generated += row.generated;
        acc.verified += row.verified;
        return acc;
      },
      { requirements: 0, scenarios: 0, generated: 0, verified: 0 }
    );
    res.json({
      coverage,
      totals,
      requirementCoveragePercent: totals.requirements
        ? Math.round((coverage.filter((row) => row.generated > 0).length / totals.requirements) * 100)
        : 0,
    });
  } catch (err) { next(err); }
});

router.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    const activity = await AiActivity.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ activity });
  } catch (err) { next(err); }
});

export default router;
