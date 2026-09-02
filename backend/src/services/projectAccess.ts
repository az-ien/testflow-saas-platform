import { Project } from '../models/Project';
import { OrganizationMember } from '../models/Organization';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

export const canAccessProject = async (project: Project, userId: string): Promise<boolean> => {
  if (project.userId === userId) return true;
  if (!project.organizationId) return false;
  const membership = await OrganizationMember.findOne({
    where: { organizationId: project.organizationId, userId },
  });
  return Boolean(membership);
};

export const getOwnedProject = async (projectId: string, userId: string): Promise<Project> => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new NotFoundError('Project');
  if (!(await canAccessProject(project, userId))) {
    throw new ForbiddenError('Project does not belong to this user');
  }
  return project;
};

export const assertOwned = (entity: { userId: string } | null, userId: string, name = 'Resource'): void => {
  if (!entity) throw new NotFoundError(name);
  if (entity.userId !== userId) throw new ForbiddenError(`${name} does not belong to this user`);
};
