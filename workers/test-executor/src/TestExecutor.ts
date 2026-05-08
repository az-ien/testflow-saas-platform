import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from './config/logger';
import { TestResult } from './models/TestRun';
import type { RunJobData } from './worker';

type SupportedFramework = 'playwright' | 'cypress' | 'selenium' | 'pytest' | 'testng' | 'jest' | 'mocha';

interface RunnerCommand {
  command: string;
  env?: Record<string, string>;
}

interface CommandResult {
  code: number | null;
}

export class TestExecutor {
  private workDir: string;
  private resultsDir: string;
  private logs: string[] = [];
  private data: RunJobData;

  constructor(data: RunJobData) {
    this.data = data;
    this.workDir = path.join(os.tmpdir(), `testflow-${data.runId}`);
    this.resultsDir = path.join(this.workDir, 'test-results');
  }

  async cloneRepo(): Promise<void> {
    this.prepareWorkspace();

    let repoUrl = this.data.repoUrl;

    if (this.data.repoAccessToken) {
      const url = new URL(repoUrl);
      url.username = 'oauth2';
      url.password = this.data.repoAccessToken;
      repoUrl = url.toString();
    }

    const branch = this.data.repoBranch || 'main';
    const cmd = `git clone --depth=1 --branch ${branch} "${repoUrl}" "${this.workDir}"`;

    this.log(`Cloning ${this.data.repoUrl} (branch: ${branch})...`);
    this.exec(cmd, os.tmpdir(), 600_000);
    fs.mkdirSync(this.resultsDir, { recursive: true });
    this.log('Repository cloned');
  }

  async installDependencies(): Promise<void> {
    fs.mkdirSync(this.resultsDir, { recursive: true });

    const hasPackageJson = this.exists('package.json');
    const hasRequirements = this.exists('requirements.txt');
    const hasPyproject = this.exists('pyproject.toml');
    const hasPomXml = this.exists('pom.xml');

    if (hasPackageJson) {
      this.installNodeDependencies();
    }

    if (hasRequirements || hasPyproject || this.data.framework === 'pytest' || this.isPythonPlaywrightRepo()) {
      this.installPythonDependencies(hasRequirements);
    }

    if (hasPomXml) {
      this.log('Resolving Maven dependencies...');
      this.exec('mvn -B dependency:resolve -q', this.workDir, 600_000);
    }

    if (!hasPackageJson && !hasRequirements && !hasPyproject && !hasPomXml) {
      this.log('No dependency manifest found; running with tools available in the worker image');
    }

    this.log('Dependencies installed');
  }

  async runTests(): Promise<TestResult[]> {
    this.log(`Running ${this.data.framework} tests...`);

    const runner = this.buildCommand();
    this.log(`Command: ${runner.command}`);

    const result = await this.execAsync(runner, this.workDir);
    const results = this.parseResults();

    if (results.length === 0 && result.code !== 0) {
      throw new Error(`Test runner exited with code ${result.code} and produced no parseable results`);
    }

    if (results.length === 0) {
      this.log('No parseable test results were produced');
    }

    return results;
  }

  async uploadReport(): Promise<string | null> {
    const reportDirs = [
      path.join(this.workDir, 'playwright-report'),
      path.join(this.workDir, 'cypress', 'reports'),
      path.join(this.workDir, 'htmlcov'),
      path.join(this.workDir, 'target', 'surefire-reports'),
    ];

    const reportDir = reportDirs.find((dir) => fs.existsSync(dir));
    if (reportDir) {
      this.log(`Report artifacts available at ${path.relative(this.workDir, reportDir)}`);
      // TODO: upload reportDir to S3 and return the public/signed report URL.
    }

    return null;
  }

  getLogs(): string[] {
    return this.logs;
  }

  async cleanup(): Promise<void> {
    try {
      fs.rmSync(this.workDir, { recursive: true, force: true });
      this.log('Workspace cleaned up');
    } catch {
      // ignore cleanup errors
    }
  }

  private prepareWorkspace(): void {
    fs.rmSync(this.workDir, { recursive: true, force: true });
    fs.mkdirSync(this.workDir, { recursive: true });
  }

  private installNodeDependencies(): void {
    this.log('Installing Node.js dependencies...');

    if (this.exists('pnpm-lock.yaml')) {
      this.exec('corepack pnpm install --frozen-lockfile', this.workDir, 600_000);
    } else if (this.exists('yarn.lock')) {
      this.exec('corepack yarn install --frozen-lockfile', this.workDir, 600_000);
    } else if (this.exists('package-lock.json')) {
      this.exec('npm ci', this.workDir, 600_000);
    } else {
      this.exec('npm install', this.workDir, 600_000);
    }

    if (this.data.framework === 'playwright') {
      this.log('Ensuring Playwright Chromium browser is installed...');
      this.exec('npx playwright install chromium', this.workDir, 600_000);
    }
  }

  private installPythonDependencies(hasRequirements: boolean): void {
    this.log('Installing Python dependencies...');

    if (hasRequirements) {
      this.exec('python3 -m pip install -r requirements.txt -q', this.workDir, 600_000);
    }

    if (this.data.framework === 'pytest' || this.data.framework === 'selenium') {
      this.exec('python3 -m pip install pytest pytest-json-report -q', this.workDir, 600_000);
    }

    if (this.isPythonPlaywrightRepo()) {
      this.exec('python3 -m pip install pytest pytest-json-report pytest-playwright playwright -q', this.workDir, 600_000);
      this.exec('python3 -m playwright install chromium', this.workDir, 600_000);
    }
  }

  private buildCommand(): RunnerCommand {
    const framework = this.data.framework as SupportedFramework;
    const pattern = this.data.testPattern?.trim();

    switch (framework) {
      case 'playwright':
        if (this.isPythonPlaywrightRepo()) {
          return {
            command: `python3 -m pytest${this.arg(pattern)} --json-report --json-report-file=test-results/pytest-results.json -v`,
          };
        }

        return {
          command: `npx playwright test${this.arg(pattern)} --reporter=json`,
          env: { PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(this.resultsDir, 'playwright-results.json') },
        };
      case 'cypress':
        return {
          command: `npx cypress run${pattern ? ` --spec "${pattern}"` : ''} --reporter junit --reporter-options "mochaFile=test-results/cypress-[hash].xml,toConsole=false"`,
        };
      case 'jest':
        return {
          command: `npx jest${this.arg(pattern)} --json --outputFile=test-results/jest-results.json --testLocationInResults`,
        };
      case 'mocha':
        return {
          command: `npx mocha${this.arg(pattern)} --reporter json > test-results/mocha-results.json`,
        };
      case 'pytest':
        return {
          command: `python3 -m pytest${this.arg(pattern)} --json-report --json-report-file=test-results/pytest-results.json -v`,
        };
      case 'testng':
        return { command: 'mvn -B test -Dsurefire.useFile=true' };
      case 'selenium':
        return this.buildSeleniumCommand(pattern);
      default:
        throw new Error(`Unsupported framework: ${this.data.framework}`);
    }
  }

  private buildSeleniumCommand(pattern?: string): RunnerCommand {
    if (this.exists('pom.xml')) {
      return { command: 'mvn -B test -Dsurefire.useFile=true' };
    }

    if (this.exists('package.json')) {
      return { command: 'npm test' };
    }

    return {
      command: `python3 -m pytest${this.arg(pattern)} --json-report --json-report-file=test-results/pytest-results.json -v`,
    };
  }

  private parseResults(): TestResult[] {
    switch (this.data.framework as SupportedFramework) {
      case 'playwright':
        return this.isPythonPlaywrightRepo() ? this.parsePytestResults() : this.parsePlaywrightResults();
      case 'jest':
        return this.parseJestResults();
      case 'mocha':
        return this.parseMochaResults();
      case 'pytest':
        return this.parsePytestResults();
      case 'cypress':
      case 'testng':
        return this.parseJUnitXml(this.findJUnitFiles());
      case 'selenium':
        return this.parseSeleniumResults();
      default:
        return [];
    }
  }

  private parsePlaywrightResults(): TestResult[] {
    const jsonFile = path.join(this.resultsDir, 'playwright-results.json');
    if (!fs.existsSync(jsonFile)) return [];

    const raw = this.readJson(jsonFile);
    const results: TestResult[] = [];
    this.collectPlaywrightSuites(raw.suites || [], [], results);
    return results;
  }

  private collectPlaywrightSuites(suites: any[], parents: string[], results: TestResult[]): void {
    for (const suite of suites) {
      const suitePath = [...parents, suite.title].filter(Boolean);

      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const attempts = test.results || [];
          const last = attempts[attempts.length - 1] || {};
          results.push({
            title: [...suitePath, spec.title].join(' > '),
            status: this.normalizeStatus(last.status),
            duration: Number(last.duration || 0),
            error: last.error?.message,
            retries: Math.max(attempts.length - 1, 0),
            screenshot: last.attachments?.find((a: any) => a.name === 'screenshot')?.path,
          });
        }
      }

      this.collectPlaywrightSuites(suite.suites || [], suitePath, results);
    }
  }

  private parseJestResults(): TestResult[] {
    const jsonFile = path.join(this.resultsDir, 'jest-results.json');
    if (!fs.existsSync(jsonFile)) return [];

    const raw = this.readJson(jsonFile);
    const results: TestResult[] = [];

    for (const suite of raw.testResults || []) {
      for (const test of suite.testResults || []) {
        results.push({
          title: test.fullName || test.title,
          status: this.normalizeStatus(test.status),
          duration: Number(test.duration || 0),
          error: test.failureMessages?.[0],
          retries: 0,
        });
      }
    }

    return results;
  }

  private parseMochaResults(): TestResult[] {
    const jsonFile = path.join(this.resultsDir, 'mocha-results.json');
    if (!fs.existsSync(jsonFile)) return [];

    const raw = this.readJson(jsonFile);
    const tests = [...(raw.passes || []), ...(raw.failures || []), ...(raw.pending || [])];

    return tests.map((test: any) => ({
      title: test.fullTitle || test.title,
      status: test.err && Object.keys(test.err).length > 0
        ? 'failed'
        : test.pending
          ? 'skipped'
          : 'passed',
      duration: Number(test.duration || 0),
      error: test.err?.message,
      retries: 0,
    }));
  }

  private parsePytestResults(): TestResult[] {
    const jsonFile = path.join(this.resultsDir, 'pytest-results.json');
    if (!fs.existsSync(jsonFile)) return [];

    const raw = this.readJson(jsonFile);
    return (raw.tests || []).map((test: any) => ({
      title: test.nodeid,
      status: this.normalizeStatus(test.outcome),
      duration: Math.round(Number(test.duration || 0) * 1000),
      error: test.call?.longrepr || test.setup?.longrepr || test.teardown?.longrepr,
      retries: 0,
    }));
  }

  private parseSeleniumResults(): TestResult[] {
    const pytestResults = this.parsePytestResults();
    if (pytestResults.length > 0) return pytestResults;
    return this.parseJUnitXml(this.findJUnitFiles());
  }

  private parseJUnitXml(files: string[]): TestResult[] {
    const results: TestResult[] = [];

    for (const file of files) {
      const xml = fs.readFileSync(file, 'utf8');
      const cases = xml.match(/<testcase\b[\s\S]*?<\/testcase>|<testcase\b[^/]*\/>/g) || [];

      for (const testcase of cases) {
        const openingTag = testcase.match(/<testcase\b[^>]*>/)?.[0] || '';
        const attrs = this.parseXmlAttributes(openingTag);
        const failure = testcase.match(/<(failure|error)\b[^>]*>([\s\S]*?)<\/\1>/);
        const skipped = /<skipped\b/.test(testcase);
        const className = attrs.classname ? `${attrs.classname}.` : '';

        results.push({
          title: `${className}${attrs.name || 'unnamed test'}`,
          status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
          duration: Math.round(Number(attrs.time || 0) * 1000),
          error: failure ? this.stripXml(failure[2]) : undefined,
          retries: 0,
        });
      }
    }

    return results;
  }

  private findJUnitFiles(): string[] {
    const candidates = [
      this.resultsDir,
      path.join(this.workDir, 'target', 'surefire-reports'),
      path.join(this.workDir, 'target', 'failsafe-reports'),
    ];

    const files = new Set<string>();
    for (const dir of candidates) {
      for (const file of this.findFiles(dir, /\.xml$/)) {
        files.add(file);
      }
    }

    return [...files];
  }

  private findFiles(dir: string, pattern: RegExp): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.findFiles(fullPath, pattern));
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private parseXmlAttributes(tag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrPattern = /(\w+)="([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = attrPattern.exec(tag)) !== null) {
      attrs[match[1]] = this.decodeXml(match[2]);
    }

    return attrs;
  }

  private stripXml(value: string): string {
    return this.decodeXml(value.replace(/<[^>]+>/g, '').trim());
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private normalizeStatus(status: string): TestResult['status'] {
    switch (status) {
      case 'passed':
      case 'ok':
        return 'passed';
      case 'skipped':
      case 'pending':
      case 'disabled':
        return 'skipped';
      case 'timedOut':
      case 'timedout':
      case 'timeout':
        return 'timedOut';
      default:
        return 'failed';
    }
  }

  private exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.workDir, relativePath));
  }

  private isPythonPlaywrightRepo(): boolean {
    if (this.data.framework !== 'playwright') return false;
    if (this.exists('package.json')) return false;

    return this.exists('requirements.txt')
      || this.exists('pyproject.toml')
      || this.findFiles(this.workDir, /\.py$/).length > 0;
  }

  private arg(value?: string): string {
    return value ? ` ${value}` : '';
  }

  private readJson(file: string): any {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err: any) {
      throw new Error(`Unable to parse ${path.relative(this.workDir, file)}: ${err.message}`);
    }
  }

  private log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(line);
    logger.info(msg);
  }

  private exec(cmd: string, cwd: string, timeout: number): string {
    try {
      const out = execSync(cmd, { cwd, timeout, encoding: 'utf8', stdio: 'pipe' });
      if (out) this.logs.push(out);
      return out;
    } catch (err: any) {
      const stdout = err.stdout?.toString().trim();
      const stderr = err.stderr?.toString().trim();
      if (stdout) this.logs.push(stdout);
      if (stderr) this.logs.push(stderr);
      this.log(`Command failed: ${err.message}`);
      throw err;
    }
  }

  private execAsync(runner: RunnerCommand, cwd: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(runner.command, [], {
        cwd,
        env: { ...process.env, ...(this.data.environmentVariables || {}), ...(runner.env || {}) },
        shell: true,
      });

      proc.stdout.on('data', (data: Buffer) => this.log(data.toString().trim()));
      proc.stderr.on('data', (data: Buffer) => this.log(data.toString().trim()));
      proc.on('close', (code) => resolve({ code }));
      proc.on('error', reject);
    });
  }
}
