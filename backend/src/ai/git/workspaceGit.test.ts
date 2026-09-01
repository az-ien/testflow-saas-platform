import { ValidationError } from '../../middleware/errorHandler';
import { captureWorkspaceGitState, gitStatusForRemote, publishGeneratedWorkspace } from './workspaceGit';

describe('gitStatusForRemote', () => {
  it('requires both a repo URL and a token before publish approval', () => {
    expect(gitStatusForRemote(true, true)).toBe('awaiting_approval');
    expect(gitStatusForRemote(true, false)).toBe('unavailable');
    expect(gitStatusForRemote(false, true)).toBe('unavailable');
    expect(gitStatusForRemote(false, false)).toBe('unavailable');
  });
});

describe('captureWorkspaceGitState', () => {
  it('treats files as added when no GitHub token is configured', async () => {
    const result = await captureWorkspaceGitState({
      files: [{ path: 'tests/a.spec.ts', content: 'test()', language: 'typescript', kind: 'test' }],
      project: { repoUrl: null, repoAccessToken: null },
      github: { fetchFile: jest.fn() },
    });
    expect(result.gitStatus).toBe('unavailable');
    expect(result.workspaceDiff[0].change).toBe('added');
    expect(result.workspaceDiff[0].patch).toContain('+test()');
  });

  it('diffs against remote files when a token exists', async () => {
    const fetchFile = jest.fn(async (_repo: string, _token: string, path: string) =>
      path === 'pages/A.ts' ? 'old' : null
    );
    const result = await captureWorkspaceGitState({
      files: [
        { path: 'tests/a.spec.ts', content: 'new', language: 'typescript', kind: 'test' },
        { path: 'pages/A.ts', content: 'new page', language: 'typescript', kind: 'page_object' },
      ],
      project: {
        repoUrl: 'https://github.com/acme/app',
        repoAccessToken: 'token',
        repoBranch: 'main',
      },
      github: { fetchFile },
    });
    expect(result.gitStatus).toBe('awaiting_approval');
    expect(fetchFile).toHaveBeenCalledTimes(2);
    expect(result.workspaceDiff.find((item) => item.path === 'tests/a.spec.ts')?.change).toBe('added');
    expect(result.workspaceDiff.find((item) => item.path === 'pages/A.ts')?.change).toBe('modified');
  });
});

describe('publishGeneratedWorkspace', () => {
  const files = [{ path: 'tests/a.spec.ts', content: 'x', language: 'typescript', kind: 'test' }];

  it('returns an existing pull request without opening another', async () => {
    const generated = {
      gitStatus: 'pr_opened',
      pullRequestUrl: 'https://github.com/acme/app/pull/9',
      branchName: 'testflow/generated-abcd1234',
      files,
      update: jest.fn(),
    } as any;
    const createPullRequest = jest.fn();
    const result = await publishGeneratedWorkspace({
      generated,
      project: { repoUrl: 'https://github.com/acme/app', repoAccessToken: 'token', repoBranch: 'main' } as any,
      branchName: 'testflow/generated-abcd1234',
      title: 't',
      body: 'b',
      github: { createPullRequest },
    });
    expect(result.alreadyOpened).toBe(true);
    expect(result.pullRequestUrl).toContain('/pull/9');
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('refuses dashboard-only workspaces', async () => {
    await expect(
      publishGeneratedWorkspace({
        generated: { gitStatus: 'unavailable', files, update: jest.fn() } as any,
        project: { repoUrl: 'https://github.com/acme/app', repoAccessToken: 'token', repoBranch: 'main' } as any,
        branchName: 'testflow/generated-abcd1234',
        title: 't',
        body: 'b',
        github: { createPullRequest: jest.fn() },
      })
    ).rejects.toThrow(ValidationError);
  });

  it('refuses to publish onto main', async () => {
    await expect(
      publishGeneratedWorkspace({
        generated: { gitStatus: 'awaiting_approval', files, update: jest.fn() } as any,
        project: { repoUrl: 'https://github.com/acme/app', repoAccessToken: 'token', repoBranch: 'main' } as any,
        branchName: 'main',
        title: 't',
        body: 'b',
        github: { createPullRequest: jest.fn() },
      })
    ).rejects.toThrow(/protected branch/);
  });

  it('opens a feature-branch pull request when approved', async () => {
    const generated = { gitStatus: 'awaiting_approval', files, update: jest.fn() } as any;
    const createPullRequest = jest.fn().mockResolvedValue({
      pullRequestUrl: 'https://github.com/acme/app/pull/12',
      branchName: 'testflow/generated-abcd1234',
    });
    const result = await publishGeneratedWorkspace({
      generated,
      project: { repoUrl: 'https://github.com/acme/app', repoAccessToken: 'token', repoBranch: 'main' } as any,
      branchName: 'testflow/generated-abcd1234',
      title: 't',
      body: 'b',
      github: { createPullRequest },
    });
    expect(result.alreadyOpened).toBe(false);
    expect(createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: 'testflow/generated-abcd1234',
        baseBranch: 'main',
      })
    );
    expect(generated.update).toHaveBeenCalledWith(
      expect.objectContaining({ gitStatus: 'pr_opened', status: 'pr_opened' })
    );
  });
});
