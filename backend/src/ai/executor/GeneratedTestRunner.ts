import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { GeneratedFile } from '../types';
import { CompileStatus, ExecutionStatus } from '../types';
import type { RunSummary, TestResult } from '../../models/TestRun';
import {
  generatedWorkspaceDir,
  linkWorkspaceNodeModules,
  resolveBackendRoot,
  writeGeneratedWorkspace,
} from '../generator/workspace';
import { generatedFileIssues } from '../generator/safety';
import { logger } from '../../config/logger';

export type { CompileStatus, ExecutionStatus } from '../types';

export interface CompileResult {
  ok: boolean;
  status: CompileStatus;
  log: string;
}

export interface GeneratedRunResult {
  status: 'passed' | 'failed' | 'error';
  summary: RunSummary;
  results: TestResult[];
  logs: string[];
}

const COMPILE_TIMEOUT_MS = 60_000;
const EXECUTE_TIMEOUT_MS = 180_000;

export class GeneratedTestRunner {
  workspacePath(input: { userId: string; projectId: string; generatedTestId: string }): string {
    return generatedWorkspaceDir(input);
  }

  async materialize(input: {
    userId: string;
    projectId: string;
    generatedTestId: string;
    files: GeneratedFile[];
  }): Promise<string> {
    const workspaceDir = this.workspacePath(input);
    await writeGeneratedWorkspace(workspaceDir, input.files || []);
    await linkWorkspaceNodeModules(workspaceDir);
    return workspaceDir;
  }

  async compileCheck(workspaceDir: string): Promise<CompileResult> {
    const staticIssues = this.staticIssues(workspaceDir);
    if (staticIssues.length) {
      return { ok: false, status: 'failed', log: staticIssues.join('\n') };
    }

    const run = await this.spawnPlaywright(workspaceDir, ['test', '--list'], COMPILE_TIMEOUT_MS, {});
    const ok = run.exitCode === 0;
    return {
      ok,
      status: ok ? 'compiles' : 'failed',
      log: [run.stdout, run.stderr].filter(Boolean).join('\n').slice(0, 20_000),
    };
  }

  async execute(
    workspaceDir: string,
    env: Record<string, string | undefined>
  ): Promise<GeneratedRunResult> {
    const started = Date.now();
    const run = await this.spawnPlaywright(workspaceDir, ['test'], EXECUTE_TIMEOUT_MS, env);
    const report = this.readJsonReport(workspaceDir);
    const parsed = this.parseReport(report);
    const logs = [run.stdout, run.stderr].filter(Boolean);
    const duration = Date.now() - started;

    if (run.timedOut) {
      return {
        status: 'error',
        summary: parsed.summary.total
          ? parsed.summary
          : { total: 0, passed: 0, failed: 0, skipped: 0, duration },
        results: parsed.results,
        logs: [...logs, 'Generated Playwright run timed out'],
      };
    }

    if (run.exitCode === 0) {
      return {
        status: 'passed',
        summary: parsed.summary.total
          ? parsed.summary
          : { total: Math.max(parsed.results.length, 1), passed: Math.max(parsed.results.length, 1), failed: 0, skipped: 0, duration },
        results: parsed.results.length ? parsed.results : [{ title: 'generated tests', status: 'passed', duration, retries: 0 }],
        logs,
      };
    }

    if (parsed.results.some((result) => result.status === 'failed' || result.status === 'timedOut') || run.exitCode === 1) {
      return {
        status: 'failed',
        summary: parsed.summary.total
          ? parsed.summary
          : { total: Math.max(parsed.results.length, 1), passed: 0, failed: Math.max(parsed.results.length, 1), skipped: 0, duration },
        results: parsed.results.length
          ? parsed.results
          : [{ title: 'generated tests', status: 'failed', duration, error: logs.join('\n').slice(0, 4000), retries: 0 }],
        logs,
      };
    }

    return {
      status: 'error',
      summary: { total: parsed.results.length, passed: 0, failed: parsed.results.length, skipped: 0, duration },
      results: parsed.results,
      logs,
    };
  }

  private staticIssues(workspaceDir: string): string[] {
    const required = ['pages', 'fixtures/baseTest.ts', 'test-data/users.ts', 'tests', 'playwright.config.ts'];
    const missing = required.filter((relative) => !fs.existsSync(path.join(workspaceDir, relative)));
    if (missing.length) {
      return [`Workspace is missing: ${missing.join(', ')}`];
    }

    const files: GeneratedFile[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'test-results') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          files.push({
            path: path.relative(workspaceDir, full),
            content: fs.readFileSync(full, 'utf8'),
            language: 'typescript',
            kind: 'test',
          });
        }
      }
    };
    walk(workspaceDir);
    return generatedFileIssues(
      files.map((file) => ({
        ...file,
        kind:
          file.path.startsWith('pages/')
            ? 'page_object'
            : file.path.startsWith('fixtures/')
              ? 'fixture'
              : file.path.startsWith('test-data/')
                ? 'test_data'
                : file.path.startsWith('tests/')
                  ? 'test'
                  : 'config',
      }))
    ).filter((issue) => !issue.startsWith('Missing generated file kind'));
  }

  private spawnPlaywright(
    workspaceDir: string,
    args: string[],
    timeoutMs: number,
    extraEnv: Record<string, string | undefined>
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
    const { command, args: argv } = this.playwrightCommand(args);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.compactEnv(extraEnv),
      CI: '1',
    };
    delete env.JEST_WORKER_ID;
    delete env.JEST_WORKER_PATH;
    delete env.JEST;

    return new Promise((resolve) => {
      const child = spawn(command, argv, {
        cwd: workspaceDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error('Generated Playwright spawn failed', { error: err.message, workspaceDir });
        resolve({ stdout, stderr: `${stderr}\n${err.message}`, exitCode: 127, timedOut });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });
    });
  }

  private playwrightCommand(args: string[]): { command: string; args: string[] } {
    const candidates = [
      path.join(resolveBackendRoot(), 'node_modules', '.bin', 'playwright'),
      path.join(process.cwd(), 'node_modules', '.bin', 'playwright'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return { command: candidate, args };
    }
    try {
      return { command: process.execPath, args: [require.resolve('@playwright/test/cli'), ...args] };
    } catch {
      return { command: 'npx', args: ['playwright', ...args] };
    }
  }

  private compactEnv(env: Record<string, string | undefined>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }

  private readJsonReport(workspaceDir: string): unknown {
    const reportPath = path.join(workspaceDir, 'test-results', 'results.json');
    if (!fs.existsSync(reportPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
      return null;
    }
  }

  private parseReport(report: any): { results: TestResult[]; summary: RunSummary } {
    const results: TestResult[] = [];
    const walk = (suite: any, prefix = '') => {
      if (!suite) return;
      const titlePrefix = [prefix, suite.title].filter(Boolean).join(' › ');
      for (const spec of suite.specs || []) {
        const test = (spec.tests || [])[0];
        const last = (test?.results || [])[(test?.results || []).length - 1] || {};
        const rawStatus = String(last.status || (spec.ok ? 'passed' : 'failed'));
        const status: TestResult['status'] =
          rawStatus === 'passed' || rawStatus === 'expected'
            ? 'passed'
            : rawStatus === 'skipped'
              ? 'skipped'
              : rawStatus === 'timedOut'
                ? 'timedOut'
                : 'failed';
        results.push({
          title: [titlePrefix, spec.title].filter(Boolean).join(' › '),
          status,
          duration: Number(last.duration || 0),
          error: last.error?.message || last.error?.stack,
          retries: Math.max(0, (test?.results || []).length - 1),
        });
      }
      for (const child of suite.suites || []) walk(child, titlePrefix);
    };

    if (report?.suites) {
      for (const suite of report.suites) walk(suite);
    }

    const summary: RunSummary = {
      total: results.length,
      passed: results.filter((row) => row.status === 'passed').length,
      failed: results.filter((row) => row.status === 'failed' || row.status === 'timedOut').length,
      skipped: results.filter((row) => row.status === 'skipped').length,
      duration: results.reduce((sum, row) => sum + row.duration, 0),
    };
    return { results, summary };
  }
}

export default GeneratedTestRunner;
