import { execFileSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from './config/logger';
import { TestResult } from './models/TestRun';
import type { RunJobData } from './worker';

type SupportedFramework = 'playwright' | 'cypress' | 'selenium' | 'pytest' | 'testng' | 'jest' | 'mocha';

interface RunnerCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
  stdoutFile?: string;
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
    this.log(`Cloning ${this.data.repoUrl} (branch: ${branch})...`);
    this.exec('git', ['clone', '--depth=1', '--branch', branch, repoUrl, this.workDir], os.tmpdir(), 600_000);
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

    if (hasRequirements || hasPyproject || this.data.framework === 'pytest' || this.data.framework === 'selenium' || this.isPythonPlaywrightRepo()) {
      this.installPythonDependencies(hasRequirements);
    }

    if (hasPomXml) {
      this.log('Resolving Maven dependencies...');
      this.exec(this.bin('mvn'), ['-B', 'dependency:resolve', '-q'], this.workDir, 600_000);
    }

    if (!hasPackageJson && !hasRequirements && !hasPyproject && !hasPomXml) {
      this.log('No dependency manifest found; running with tools available in the worker image');
    }

    this.log('Dependencies installed');
  }

  async runTests(): Promise<TestResult[]> {
    this.log(`Running ${this.data.framework} tests...`);

    const runner = this.buildCommand();
    this.log(`Command: ${this.formatCommand(runner)}`);

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
      const bucket = process.env.S3_BUCKET;
      if (bucket && process.env.AWS_ACCESS_KEY_ID && !String(process.env.AWS_ACCESS_KEY_ID).includes('xxxxx')) {
        try {
          const prefix = `s3://${bucket}/runs/${this.data.runId || 'report'}`;
          this.exec('aws', ['s3', 'sync', reportDir, prefix], this.workDir, 120_000);
          this.log(`Uploaded report to ${prefix}`);
          return prefix;
        } catch (err: any) {
          this.log(`S3 upload skipped: ${err.message}`);
        }
      }
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
      this.execNodeTool('corepack', ['pnpm', 'install', '--frozen-lockfile'], this.workDir, 600_000);
    } else if (this.exists('yarn.lock')) {
      this.execNodeTool('corepack', ['yarn', 'install', '--frozen-lockfile'], this.workDir, 600_000);
    } else if (this.exists('package-lock.json')) {
      this.execNodeTool('npm', ['ci'], this.workDir, 600_000);
    } else {
      this.execNodeTool('npm', ['install'], this.workDir, 600_000);
    }

    if (this.data.framework === 'playwright') {
      this.log('Ensuring Playwright Chromium browser is installed...');
      this.execNodeTool('npx', ['playwright', 'install', 'chromium'], this.workDir, 600_000);
    }
  }

  private installPythonDependencies(hasRequirements: boolean): void {
    this.log('Installing Python dependencies...');

    this.ensurePythonVirtualEnv();
    const python = this.pythonExecutable();

    if (this.exists('poetry.lock') || (this.exists('pyproject.toml') && this.pyprojectUses('poetry'))) {
      this.log('Installing via Poetry');
      this.exec('poetry', ['install', '--no-interaction', '--no-ansi'], this.workDir, 600_000);
    } else if (this.exists('pdm.lock') || (this.exists('pyproject.toml') && this.pyprojectUses('pdm'))) {
      this.log('Installing via PDM');
      this.exec('pdm', ['install'], this.workDir, 600_000);
    } else if (this.exists('uv.lock') || (this.exists('pyproject.toml') && this.pyprojectUses('uv'))) {
      this.log('Installing via uv');
      this.exec('uv', ['sync'], this.workDir, 600_000);
    } else if (hasRequirements) {
      this.exec(python, ['-m', 'pip', 'install', '-r', 'requirements.txt', '-q'], this.workDir, 600_000);
    } else if (this.exists('pyproject.toml')) {
      this.exec(python, ['-m', 'pip', 'install', '.', '-q'], this.workDir, 600_000);
    }

    if (this.data.framework === 'pytest' || this.data.framework === 'selenium') {
      this.exec(python, ['-m', 'pip', 'install', 'pytest', 'pytest-json-report', '-q'], this.workDir, 600_000);
    }

    if (this.isPythonPlaywrightRepo()) {
      this.exec(python, ['-m', 'pip', 'install', 'pytest', 'pytest-json-report', 'pytest-playwright', 'playwright', '-q'], this.workDir, 600_000);
      this.exec(python, ['-m', 'playwright', 'install', 'chromium'], this.workDir, 600_000);
    }
  }

  private buildCommand(): RunnerCommand {
    const framework = this.data.framework as SupportedFramework;
    const pattern = this.data.testPattern?.trim();

    switch (framework) {
      case 'playwright':
        if (this.isPythonPlaywrightRepo()) {
          return {
            command: this.pythonExecutable(),
            args: ['-m', 'pytest', ...this.patternArgs(pattern), '--json-report', '--json-report-file=test-results/pytest-results.json', '-v'],
          };
        }

        return {
          ...this.nodeTool('npx', ['playwright', 'test', ...this.patternArgs(pattern), '--reporter=json']),
          env: { PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(this.resultsDir, 'playwright-results.json') },
        };
      case 'cypress':
        return {
          ...this.nodeTool('npx', [
            'cypress',
            'run',
            ...this.cypressSpecArgs(pattern),
            '--reporter',
            'junit',
            '--reporter-options',
            'mochaFile=test-results/cypress-[hash].xml,toConsole=false',
          ]),
        };
      case 'jest':
        return {
          ...this.nodeTool('npx', ['jest', ...this.patternArgs(pattern), '--json', '--outputFile=test-results/jest-results.json', '--testLocationInResults']),
        };
      case 'mocha':
        return {
          ...this.nodeTool('npx', ['mocha', ...this.patternArgs(pattern), '--reporter', 'json']),
          stdoutFile: path.join(this.resultsDir, 'mocha-results.json'),
        };
      case 'pytest':
        return {
          command: this.pythonExecutable(),
          args: ['-m', 'pytest', ...this.patternArgs(pattern), '--json-report', '--json-report-file=test-results/pytest-results.json', '-v'],
        };
      case 'testng':
        return { command: this.bin('mvn'), args: ['-B', 'test', '-Dsurefire.useFile=true'] };
      case 'selenium':
        return this.buildSeleniumCommand(pattern);
      default:
        throw new Error(`Unsupported framework: ${this.data.framework}`);
    }
  }

  private buildSeleniumCommand(pattern?: string): RunnerCommand {
    if (this.exists('pom.xml')) {
      return { command: this.bin('mvn'), args: ['-B', 'test', '-Dsurefire.useFile=true'] };
    }

    if (this.exists('package.json')) {
      return this.nodeTool('npm', ['test']);
    }

    return {
      command: this.pythonExecutable(),
      args: ['-m', 'pytest', ...this.patternArgs(pattern), '--json-report', '--json-report-file=test-results/pytest-results.json', '-v'],
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

  private pyprojectUses(tool: 'poetry' | 'pdm' | 'uv'): boolean {
    if (!this.exists('pyproject.toml')) return false;
    const text = fs.readFileSync(path.join(this.workDir, 'pyproject.toml'), 'utf8');
    if (tool === 'poetry') return /\[tool\.poetry\]/.test(text);
    if (tool === 'pdm') return /\[tool\.pdm\]/.test(text);
    return /\[tool\.uv\]/.test(text) || /requires-python/.test(text);
  }

  private isPythonPlaywrightRepo(): boolean {
    if (this.data.framework !== 'playwright') return false;
    if (this.exists('package.json')) return false;

    return this.exists('requirements.txt')
      || this.exists('pyproject.toml')
      || this.findFiles(this.workDir, /\.py$/).length > 0;
  }

  private patternArgs(value?: string): string[] {
    return value ? [value] : [];
  }

  private cypressSpecArgs(pattern?: string): string[] {
    return pattern ? ['--spec', pattern] : [];
  }

  private bin(name: 'mvn'): string {
    return process.platform === 'win32' ? `${name}.cmd` : name;
  }

  private execNodeTool(name: 'corepack' | 'npm' | 'npx', args: string[], cwd: string, timeout: number): string {
    const command = this.nodeTool(name, args);
    return this.exec(command.command, command.args, cwd, timeout);
  }

  private nodeTool(name: 'corepack' | 'npm' | 'npx', args: string[]): RunnerCommand {
    if (process.platform !== 'win32') {
      return { command: name, args };
    }

    return {
      command: process.execPath,
      args: [this.nodeToolScript(name), ...args],
    };
  }

  private nodeToolScript(name: 'corepack' | 'npm' | 'npx'): string {
    const nodeRoot = path.dirname(process.execPath);
    if (name === 'corepack') {
      return path.join(nodeRoot, 'node_modules', 'corepack', 'dist', 'corepack.js');
    }

    return path.join(nodeRoot, 'node_modules', 'npm', 'bin', `${name}-cli.js`);
  }

  private pythonBin(): string {
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private ensurePythonVirtualEnv(): void {
    const venvPython = this.pythonExecutable();
    if (fs.existsSync(venvPython)) return;

    this.exec(this.pythonBin(), ['-m', 'venv', '.venv'], this.workDir, 600_000);
  }

  private pythonExecutable(): string {
    return process.platform === 'win32'
      ? path.join(this.workDir, '.venv', 'Scripts', 'python.exe')
      : path.join(this.workDir, '.venv', 'bin', 'python');
  }

  private formatCommand(runner: RunnerCommand): string {
    return [runner.command, ...runner.args].join(' ');
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

  private exec(command: string, args: string[], cwd: string, timeout: number): string {
    try {
      const out = execFileSync(command, args, { cwd, timeout, encoding: 'utf8', stdio: 'pipe' });
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
      const outputStream = runner.stdoutFile ? fs.createWriteStream(runner.stdoutFile) : null;
      const proc = spawn(runner.command, runner.args, {
        cwd,
        env: { ...process.env, ...(this.data.environmentVariables || {}), ...(runner.env || {}) },
        shell: false,
      });

      proc.stdout.on('data', (data: Buffer) => {
        if (outputStream) outputStream.write(data);
        this.log(data.toString().trim());
      });
      proc.stderr.on('data', (data: Buffer) => this.log(data.toString().trim()));
      proc.on('close', (code) => {
        outputStream?.end();
        resolve({ code });
      });
      proc.on('error', (err) => {
        outputStream?.end();
        reject(err);
      });
    });
  }
}
