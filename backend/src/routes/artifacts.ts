import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getOwnedProject } from '../services/projectAccess';
import { listArtifacts, readOwnedArtifact } from '../services/ArtifactStore';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.userId);
    const prefix = typeof req.query.path === 'string' ? req.query.path : '';
    res.json({ artifacts: listArtifacts(project.userId, project.id, prefix) });
  } catch (err) { next(err); }
});

router.get('/:projectId/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.userId);
    const relative = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relative) throw new ValidationError('path is required');
    const file = readOwnedArtifact(project.userId, project.id, relative);
    res.setHeader('Content-Type', file.contentType);
    res.sendFile(file.absPath);
  } catch (err) { next(err); }
});

export default router;
