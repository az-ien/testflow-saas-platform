import { ValidationError } from '../../middleware/errorHandler';

export const PROTECTED_BRANCHES = new Set(['main', 'master', 'production', 'prod']);

export function normalizeRef(ref?: string | null): string {
  return (ref || '').replace(/^refs\/heads\//i, '').trim();
}

export function isProtectedBranch(name: string): boolean {
  return PROTECTED_BRANCHES.has(normalizeRef(name).toLowerCase());
}

export function assertFeatureBranch(head: string, base: string): void {
  const headName = normalizeRef(head);
  const baseName = normalizeRef(base);
  if (!headName) {
    throw new ValidationError('Pull request head branch is required');
  }
  if (isProtectedBranch(headName)) {
    throw new ValidationError(`Cannot open a pull request from protected branch "${headName}"`);
  }
  if (headName.toLowerCase() === baseName.toLowerCase()) {
    throw new ValidationError('Pull request head must be a feature branch, not the same as the base branch');
  }
}

export function generatedFeatureBranch(generatedTestId: string): string {
  return `testflow/generated-${generatedTestId.slice(0, 8)}`;
}

export function healFeatureBranch(healingAttemptId: string): string {
  return `testflow/heal-${healingAttemptId.slice(0, 8)}`;
}
