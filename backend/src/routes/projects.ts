import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { Project } from '../models/Project';
import { TestRun } from '../models/TestRun';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

// GET /api/projects
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await Project.findAll({
      where: { userId: req.user!.userId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ projects, total: projects.length });
  } catch (err) { next(err); }
});

// POST /api/projects
router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 200 }),
    body('repoUrl').isURL(),
    body('repoProvider').isIn(['github', 'gitlab', 'bitbucket', 'azure_devops']),
    body('framework').isIn(['playwright', 'cypress', 'selenium', 'pytest', 'testng', 'jest', 'mocha']),
    body('repoBranch').optional().trim(),
    body('testPattern').optional().trim(),
    body('webhookUrl').optional().isURL(),
    body('repoAccessToken').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await Project.create({ ...req.body, userId: req.user!.userId });
      res.status(201).json(project);
    } catch (err) { next(err); }
  }
);

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [{ association: 'runs', limit: 10, order: [['createdAt', 'DESC']] }],
    });
    if (!project) throw new NotFoundError('Project');
    if (project.userId !== req.user!.userId) throw new ForbiddenError();
    res.json(project);
  } catch (err) { next(err); }
});

// PATCH /api/projects/:id
router.patch('/:id',
  [
    body('name').optional().trim().isLength({ max: 200 }),
    body('repoBranch').optional().trim(),
    body('testPattern').optional().trim(),
    body('webhookUrl').optional().isURL(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await Project.findByPk(req.params.id);
      if (!project) throw new NotFoundError('Project');
      if (project.userId !== req.user!.userId) throw new ForbiddenError();
      await project.update(req.body);
      res.json(project);
    } catch (err) { next(err); }
  }
);

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) throw new NotFoundError('Project');
    if (project.userId !== req.user!.userId) throw new ForbiddenError();
    await project.destroy();
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/stats
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) throw new NotFoundError('Project');
    if (project.userId !== req.user!.userId) throw new ForbiddenError();

    const runs = await TestRun.findAll({ where: { projectId: project.id } });
    const passed = runs.filter(r => r.status === 'passed').length;
    const failed = runs.filter(r => r.status === 'failed').length;
    const successRate = runs.length ? Math.round((passed / runs.length) * 100) : 0;
    const avgDuration = runs.length
      ? Math.round(runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.length)
      : 0;

    res.json({ total: runs.length, passed, failed, successRate, avgDurationMs: avgDuration });
  } catch (err) { next(err); }
});

export default router;
