import { AiActivity } from '../models/AiActivity';

export const recordActivity = async (input: {
  projectId: string;
  userId: string;
  action: string;
  actor?: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}): Promise<void> => {
  await AiActivity.create({
    projectId: input.projectId,
    userId: input.userId,
    action: input.action,
    actor: input.actor || 'system',
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    correlationId: input.correlationId || null,
    details: input.details || {},
  });
};
