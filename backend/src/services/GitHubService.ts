import axios from 'axios';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { GeneratedFile, RepoInventory } from '../ai/types';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  state: string;
}

export const parseGitHubRepo = (repoUrl?: string | null): { owner: string; repo: string } | null => {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?(?:\/)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
};

const headers = (token?: string | null) => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'testflow-ai-qe',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export class GitHubService {
  async listOpenIssues(repoUrl: string, token?: string | null, limit = 20): Promise<GitHubIssue[]> {
    const parsed = parseGitHubRepo(repoUrl);
    if (!parsed) throw new AppError('Project repository is not a GitHub URL', 422);
    const { data } = await axios.get(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues`, {
      headers: headers(token),
      params: { state: 'open', per_page: limit },
      timeout: 20000,
    });
    return (data as any[])
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        htmlUrl: issue.html_url,
        state: issue.state,
      }));
  }

  async inspectRepository(repoUrl: string, token?: string | null, branch = 'main'): Promise<RepoInventory> {
    const parsed = parseGitHubRepo(repoUrl);
    if (!parsed) {
      return {
        framework: 'playwright',
        hasPlaywrightConfig: false,
        testDir: 'tests/generated',
        existingPages: [],
        existingFixtures: [],
        existingTests: [],
      };
    }

    const inventory: RepoInventory = {
      framework: 'playwright',
      hasPlaywrightConfig: false,
      testDir: 'tests/generated',
      existingPages: [],
      existingFixtures: [],
      existingTests: [],
    };

    try {
      const { data } = await axios.get(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers: headers(token), timeout: 20000 }
      );
      const paths: string[] = (data.tree || []).filter((item: any) => item.type === 'blob').map((item: any) => item.path as string);
      inventory.hasPlaywrightConfig = paths.some((p) => p === 'playwright.config.ts' || p === 'playwright.config.js');
      inventory.existingPages = paths.filter((p) => /^pages\/.+\.ts$/.test(p));
      inventory.existingFixtures = paths.filter((p) => /^fixtures\/.+\.ts$/.test(p));
      inventory.existingTests = paths.filter((p) => /tests\/.+\.spec\.ts$/.test(p));
      if (paths.some((p) => p.startsWith('tests/'))) inventory.testDir = 'tests/generated';
      if (paths.some((p) => p.startsWith('pages/'))) inventory.pagesDir = 'pages';
      if (paths.some((p) => p.startsWith('fixtures/'))) inventory.fixturesDir = 'fixtures';
      if (paths.some((p) => p.startsWith('test-data/'))) inventory.testDataDir = 'test-data';
    } catch (err: any) {
      logger.warn('GitHub repository inspection failed; generating standalone Playwright files', {
        error: err.message,
      });
    }

    return inventory;
  }

  async createPullRequest(input: {
    repoUrl: string;
    token: string;
    branchName: string;
    baseBranch: string;
    title: string;
    body: string;
    files: GeneratedFile[];
  }): Promise<{ pullRequestUrl: string; branchName: string }> {
    const parsed = parseGitHubRepo(input.repoUrl);
    if (!parsed) throw new AppError('Project repository is not a GitHub URL', 422);

    const api = axios.create({
      baseURL: `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      headers: headers(input.token),
      timeout: 30000,
    });

    const { data: baseRef } = await api.get(`/git/ref/heads/${input.baseBranch}`);
    const baseSha = baseRef.object.sha as string;

    try {
      await api.post('/git/refs', { ref: `refs/heads/${input.branchName}`, sha: baseSha });
    } catch (err: any) {
      if (err.response?.status !== 422) throw err;
    }

    for (const file of input.files) {
      let sha: string | undefined;
      try {
        const existing = await api.get(`/contents/${file.path}`, { params: { ref: input.branchName } });
        sha = existing.data.sha;
      } catch {
        sha = undefined;
      }
      await api.put(`/contents/${file.path}`, {
        message: `testflow: add ${file.path}`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch: input.branchName,
        sha,
      });
    }

    const { data: pr } = await api.post('/pulls', {
      title: input.title,
      head: input.branchName,
      base: input.baseBranch,
      body: input.body,
    });

    return { pullRequestUrl: pr.html_url, branchName: input.branchName };
  }
}

export default new GitHubService();
