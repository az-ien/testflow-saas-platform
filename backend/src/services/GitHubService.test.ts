import { parseGitHubRepo } from '../services/GitHubService';

describe('GitHub repo parsing', () => {
  it('parses HTTPS and git URLs', () => {
    expect(parseGitHubRepo('https://github.com/az-ien/testflow-saas-platform')).toEqual({
      owner: 'az-ien',
      repo: 'testflow-saas-platform',
    });
    expect(parseGitHubRepo('https://github.com/az-ien/testflow-saas-platform.git')).toEqual({
      owner: 'az-ien',
      repo: 'testflow-saas-platform',
    });
  });

  it('returns null for non-GitHub remotes', () => {
    expect(parseGitHubRepo('https://gitlab.com/example/app')).toBeNull();
  });
});
