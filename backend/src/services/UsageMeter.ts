import { PLAN_LIMITS, PlanId } from '../models/Subscription';
import { User } from '../models/User';
import { PlanLimitError } from '../middleware/errorHandler';

export type UsageDimension = 'runs' | 'planning' | 'healing' | 'exploration';

const fieldFor: Record<UsageDimension, keyof User> = {
  runs: 'monthlyRunsUsed',
  planning: 'monthlyPlanningUsed',
  healing: 'monthlyHealingUsed',
  exploration: 'monthlyExplorationUsed',
};

const limitFor = (tier: PlanId, dimension: UsageDimension): number => {
  const plan = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
  if (dimension === 'runs') return plan.runs;
  return plan[dimension];
};

export const assertUsageAvailable = async (userId: string, dimension: UsageDimension): Promise<User> => {
  const user = await User.findByPk(userId);
  if (!user) throw new PlanLimitError('User not found for usage check');
  const used = Number(user[fieldFor[dimension]] || 0);
  const limit = dimension === 'runs'
    ? Number(user.monthlyRunsLimit || limitFor(user.subscriptionTier, dimension))
    : limitFor(user.subscriptionTier, dimension);
  if (used >= limit) {
    throw new PlanLimitError(
      `Monthly ${dimension} limit reached (${limit}). Upgrade your plan for additional AI QE capacity.`
    );
  }
  return user;
};

export const incrementUsage = async (userId: string, dimension: UsageDimension): Promise<void> => {
  const field = fieldFor[dimension];
  await User.increment(field as 'monthlyRunsUsed' | 'monthlyPlanningUsed' | 'monthlyHealingUsed' | 'monthlyExplorationUsed', {
    by: 1,
    where: { id: userId },
  });
};
