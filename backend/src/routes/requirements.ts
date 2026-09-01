import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { Requirement } from '../models/Requirement';
import { getOwnedProject } from '../services/projectAccess';
import { assertOwned } from '../services/projectAccess';
import { ValidationError } from '../middleware/errorHandler';
import githubService from '../services/GitHubService';
import { recordActivity } from '../services/AiAudit';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

const nextKey = async (projectId: string): Promise<string> => {
  const count = await Requirement.count({ where: { projectId } });
  return `REQ-${String(count + 1).padStart(3, '0')}`;
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (req.query.projectId) where.projectId = req.query.projectId;
    const requirements = await Requirement.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ association: 'project', attributes: ['id', 'name'] }],
    });
    res.json({ requirements, total: requirements.length });
  } catch (err) { next(err); }
});

router.post(
  '/',
  [
    body('projectId').isUUID(),
    body('title').trim().notEmpty().isLength({ max: 300 }),
    body('description').optional().trim(),
    body('acceptanceCriteria').optional().trim(),
    body('source').optional().isIn(['user_story', 'acceptance_criteria', 'feature_description', 'github_issue', 'jira_issue', 'plain_text']),
    body('key').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await getOwnedProject(req.body.projectId, req.user!.userId);
      const requirement = await Requirement.create({
        projectId: project.id,
        userId: req.user!.userId,
        key: req.body.key || await nextKey(project.id),
        title: req.body.title,
        description: req.body.description || null,
        acceptanceCriteria: req.body.acceptanceCriteria || null,
        source: req.body.source || 'plain_text',
        externalId: req.body.externalId || null,
        externalUrl: req.body.externalUrl || null,
        status: 'ready',
      });
      await recordActivity({
        projectId: project.id,
        userId: req.user!.userId,
        action: 'requirement_created',
        actor: 'user',
        entityType: 'requirement',
        entityId: requirement.id,
      });
      res.status(201).json(requirement);
    } catch (err) { next(err); }
  }
);

router.post(
  '/import/github',
  [body('projectId').isUUID(), body('issueNumber').optional().isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await getOwnedProject(req.body.projectId, req.user!.userId);
      if (!project.repoUrl) throw new ValidationError('Project has no GitHub repository URL');
      const issues = await githubService.listOpenIssues(project.repoUrl, project.repoAccessToken);
      const selected = req.body.issueNumber
        ? issues.filter((issue) => issue.number === Number(req.body.issueNumber))
        : issues;
      const created = [];
      for (const issue of selected) {
        const key = `GH-${issue.number}`;
        const [requirement] = await Requirement.findOrCreate({
          where: { projectId: project.id, key },
          defaults: {
            projectId: project.id,
            userId: req.user!.userId,
            key,
            title: issue.title,
            description: issue.body,
            acceptanceCriteria: issue.body,
            source: 'github_issue',
            externalId: String(issue.number),
            externalUrl: issue.htmlUrl,
            status: 'ready',
          },
        });
        created.push(requirement);
      }
      res.status(201).json({ imported: created.length, requirements: created });
    } catch (err) { next(err); }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requirement = await Requirement.findByPk(req.params.id, {
      include: [{ association: 'testPlans' }, { association: 'project', attributes: ['id', 'name'] }],
    });
    assertOwned(requirement, req.user!.userId, 'Requirement');
    res.json(requirement);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requirement = await Requirement.findByPk(req.params.id);
    assertOwned(requirement, req.user!.userId, 'Requirement');
    await requirement!.update({
      title: req.body.title ?? requirement!.title,
      description: req.body.description ?? requirement!.description,
      acceptanceCriteria: req.body.acceptanceCriteria ?? requirement!.acceptanceCriteria,
      status: req.body.status ?? requirement!.status,
    });
    res.json(requirement);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requirement = await Requirement.findByPk(req.params.id);
    assertOwned(requirement, req.user!.userId, 'Requirement');
    await requirement!.destroy();
    res.json({ message: 'Requirement deleted' });
  } catch (err) { next(err); }
});

export default router;
