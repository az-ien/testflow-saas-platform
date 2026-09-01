import { GeneratedFile, GitPublishStatus, WorkspaceFileDiff } from '../types';
import { ValidationError } from '../../middleware/errorHandler';
import githubService, { GitHubService } from '../../services/GitHubService';
import { assertFeatureBranch } from './featureBranch';
import { buildWorkspaceDiff } from './diff';

type PublishableWorkspace = {
  gitStatus?: GitPublishStatus;
  pullRequestUrl?: string | null;
  branchName?: string | null;
  files?: GeneratedFile[] | null;
  update: (values: Record<string, unknown>) => Promise<unknown>;
};

type PublishableProject = {
  repoUrl?: string | null;
  repoAccessToken?: string | null;
  repoBranch?: string | null;
};

export const gitStatusForRemote = (hasRepo: boolean, hasToken: boolean): GitPublishStatus => {
  if (hasRepo && hasToken) return 'awaiting_approval';
  return 'unavailable';
};

export const captureWorkspaceGitState = async (input: {
  files: GeneratedFile[];
  project: PublishableProject;
  github?: Pick<GitHubService, 'fetchFile'>;
}): Promise<{ workspaceDiff: WorkspaceFileDiff[]; gitStatus: GitPublishStatus }> => {
  const hasRepo = Boolean(input.project.repoUrl);
  const hasToken = Boolean(input.project.repoAccessToken);
  const gitStatus = gitStatusForRemote(hasRepo, hasToken);
  const existingByPath: Record<string, string | null> = {};

  if (gitStatus === 'awaiting_approval' && input.project.repoUrl && input.project.repoAccessToken) {
    const github = input.github || githubService;
    const ref = input.project.repoBranch || 'main';
    for (const file of input.files) {
      existingByPath[file.path] = await github.fetchFile(
        input.project.repoUrl,
        input.project.repoAccessToken,
        file.path,
        ref
      );
    }
  }

  return {
    workspaceDiff: buildWorkspaceDiff(input.files, existingByPath),
    gitStatus,
  };
};

export const publishGeneratedWorkspace = async (input: {
  generated: PublishableWorkspace;
  project: PublishableProject;
  branchName: string;
  title: string;
  body: string;
  github?: Pick<GitHubService, 'createPullRequest'>;
}): Promise<{ pullRequestUrl: string; branchName: string; alreadyOpened: boolean }> => {
  if (input.generated.gitStatus === 'pr_opened' && input.generated.pullRequestUrl) {
    return {
      pullRequestUrl: input.generated.pullRequestUrl,
      branchName: input.generated.branchName || input.branchName,
      alreadyOpened: true,
    };
  }
  if (!input.project.repoUrl || !input.project.repoAccessToken) {
    throw new ValidationError('A GitHub repository and access token are required to open a pull request');
  }
  if (input.generated.gitStatus === 'unavailable') {
    throw new ValidationError('This generated workspace is dashboard-only because the project has no GitHub token');
  }

  const files = input.generated.files || [];
  if (!files.length) {
    throw new ValidationError('Generated test has no files to publish');
  }

  const baseBranch = input.project.repoBranch || 'main';
  assertFeatureBranch(input.branchName, baseBranch);

  const github = input.github || githubService;
  const pr = await github.createPullRequest({
    repoUrl: input.project.repoUrl,
    token: input.project.repoAccessToken,
    branchName: input.branchName,
    baseBranch,
    title: input.title,
    body: input.body,
    files,
  });

  await input.generated.update({
    status: 'pr_opened',
    gitStatus: 'pr_opened',
    branchName: pr.branchName,
    pullRequestUrl: pr.pullRequestUrl,
  });

  return { ...pr, alreadyOpened: false };
};
