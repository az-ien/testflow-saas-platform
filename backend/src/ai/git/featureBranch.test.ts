import { GitHubService } from '../../services/GitHubService';
import { ValidationError } from '../../middleware/errorHandler';
import {
  assertFeatureBranch,
  generatedFeatureBranch,
  healFeatureBranch,
  isProtectedBranch,
} from './featureBranch';

describe('assertFeatureBranch', () => {
  it('accepts a feature branch against main', () => {
    expect(() => assertFeatureBranch('testflow/generated-abcd1234', 'main')).not.toThrow();
  });

  it('rejects main, master, and production heads', () => {
    expect(() => assertFeatureBranch('main', 'develop')).toThrow(ValidationError);
    expect(() => assertFeatureBranch('master', 'main')).toThrow(ValidationError);
    expect(() => assertFeatureBranch('production', 'main')).toThrow(ValidationError);
    expect(() => assertFeatureBranch('refs/heads/main', 'develop')).toThrow(ValidationError);
  });

  it('rejects head equal to base', () => {
    expect(() => assertFeatureBranch('testflow/generated-abcd', 'testflow/generated-abcd')).toThrow(
      /same as the base branch/
    );
  });

  it('rejects an empty head', () => {
    expect(() => assertFeatureBranch('', 'main')).toThrow(/required/);
  });
});

describe('feature branch names', () => {
  it('never uses a protected branch name', () => {
    expect(isProtectedBranch(generatedFeatureBranch('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'))).toBe(false);
    expect(isProtectedBranch(healFeatureBranch('ffffffff-1111-2222-3333-444444444444'))).toBe(false);
    expect(generatedFeatureBranch('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe('testflow/generated-aaaaaaaa');
  });
});

describe('GitHubService.createPullRequest', () => {
  it('refuses to open a pull request from main without calling GitHub', async () => {
    const service = new GitHubService();
    await expect(
      service.createPullRequest({
        repoUrl: 'https://github.com/acme/app',
        token: 'token',
        branchName: 'main',
        baseBranch: 'main',
        title: 'nope',
        body: 'nope',
        files: [{ path: 'tests/a.spec.ts', content: 'x', language: 'typescript', kind: 'test' }],
      })
    ).rejects.toThrow(ValidationError);
  });
});
