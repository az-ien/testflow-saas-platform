import { describe, expect, it } from 'vitest';
import { gitLabel } from './gitLabels';

describe('gitLabel', () => {
  it('describes publish states', () => {
    expect(gitLabel('awaiting_approval')).toBe('needs publish approval');
    expect(gitLabel('unavailable')).toBe('dashboard only');
    expect(gitLabel('pr_opened')).toBe('PR opened');
  });
});
