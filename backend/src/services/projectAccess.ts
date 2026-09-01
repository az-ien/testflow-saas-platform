import { Project } from '../models/Project';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

export const getOwnedProject = async (projectId: string, userId: string): Promise<Project> => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new NotFoundError('Project');
  if (project.userId !== userId) throw new ForbiddenError('Project does not belong to this user');
  return project;
};

export const assertOwned = (entity: { userId: string } | null, userId: string, name = 'Resource'): void => {
  if (!entity) throw new NotFoundError(name);
  if (entity.userId !== userId) throw new ForbiddenError(`${name} does not belong to this user`);
};
