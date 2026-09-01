import { assertOwned } from './projectAccess';

describe('project isolation', () => {
  it('blocks missing and cross-user records', () => {
    expect(() => assertOwned(null, 'user-a')).toThrow(/not found/i);
    expect(() => assertOwned({ userId: 'user-b' }, 'user-a')).toThrow(/does not belong/i);
    expect(() => assertOwned({ userId: 'user-a' }, 'user-a')).not.toThrow();
  });
});
