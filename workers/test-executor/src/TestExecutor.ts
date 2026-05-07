import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from './config/logger';
import { TestResult } from './models/TestRun';
import type { RunJobData } from './worker';

export class TestExecutor {
  private workDir: string;
  private logs: string[] = [];
  private data: RunJobData;

  constructor(data: RunJobData) {
    this.data = data;
    this.workDir = path.join(os.tmpdir(), `testflow-${data.runId}`);
  }

  // ─── Clone Repo ───────────────────────────────────────────────────────────
  async cloneRepo(): Promise<void> {
    fs.mkdirSync(this.workDir, { recursive: true });

    let repoUrl = this.data.repoUrl;

    // Inject access token into HTTPS URL for private repos
    if (this.data.repoAccessToken) {
      const url = new URL(repoUrl);
      url.username = 'oauth2';
      url.password = this.data.repoAccessToken;
      repoUrl = url.toString();
    }

    const branch = this.data.repoBranch || 'main';
    const cmd = `git clone --depth=1 --branch ${branch} "${repoUrl}" "${this.workDir}"`;

    this.log(`Cloning ${this.data.repoUrl} (branch: ${branch})...`);
    this.exec(cmd, os.tmpdir());
    this.log('✅ Repository cloned');
  }

  // ─── Install Dependencies ─────────────────────────────────────────────────
  async installDependencies(): Promise<void> {
    const hasPackageJson = fs.existsSync(path.join(this.workDir, 'package.json'));
    const hasRequirements = fs.existsSync(path.join(this.workDir, 'requirements.txt'));
    const hasPomXml = fs.existsSync(path.join(this.workDir, 'pom.xml'));

    if (hasPackageJson) {
      this.log('Installing Node.js dependencies...');
      this.exec('npm ci --prefer-offline', this.workDir);
      // Install Playwright browsers if needed
      if (this.data.framework === 'playwright') {
        this.log('Installing Playwright browsers...');
        this.exec('npx playwright install --with-deps chromium', this.workDir);
      }
    } else if (hasRequirements) {
      this.log('Installing Python dependencies...');
      this.exec('pip install -r requirements.txt -q', this.workDir);
    } else if (hasPomXml) {
      this.log('Resolving Maven dependencies...');
      this.exec('mvn dependency:resolve -q', this.workDir);
    }

    this.log('✅ Dependencies installed');
  }

  // ─── Run Tests ────────────────────────────────────────────────────────────
  async runTests(): Promise<TestResult[]> {
    this.log(`Running ${this.data.framework} tests...`);

    const command = this.buildCommand();
    this.log(`Command: ${command}`);

    await this.execAsync(command, this.workDir);
    return this.parseResults();
  }

  // ─── Build Framework Command ──────────────────────────────────────────────
  private buildCommand(): string {
    const pattern = this.data.testPattern || '';
    const env = Object.entries(this.data.environmentVariables || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const envPrefix = env ? `${env} ` : '';

    switch (this.data.framework) {
      case 'playwright':
        return `${envPrefix}npx playwright test ${pattern} --reporter=json --output-dir=test-results`;
      case 'cypress':
        return `${envPrefix}npx cypress run --spec "${pattern}" --reporter json`;
      case 'jest':
        return `${envPrefix}npx jest ${pattern} --json --outputFile=test-results/jest-results.json`;
      case 'mocha':
        return `${envPrefix}npx mocha ${pattern} --reporter json > test-results/mocha-results.json`;
      case 'pytest':
        return `${envPrefix}python -m pytest ${pattern} --json-report --json-report-file=test-results/pytest-results.json -v`;
      case 'testng':
        return `${envPrefix}mvn test -Dsurefire.reportFormat=brief`;
      default:
        throw new Error(`Unsupported framework: ${this.data.framework}`);
    }
  }

  // ─── Parse Results ────────────────────────────────────────────────────────
  private parseResults(): TestResult[] {
    const resultsDir = path.join(this.workDir, 'test-results');
    if (!fs.existsSync(resultsDir)) {
      this.log('⚠️ No test-results directory found');
      return [];
    }

    switch (this.data.framework) {
      case 'playwright': return this.parsePlaywrightResults(resultsDir);
      case 'jest':       return this.parseJestResults(resultsDir);
      case 'pytest':     return this.parsePytestResults(resultsDir);
      default:           return this.parseJUnitXml(resultsDir);
    }
  }

  private parsePlaywrightResults(dir: string): TestResult[] {
    const jsonFile = path.join(dir, 'results.json');
    if (!fs.existsSync(jsonFile)) return [];

    const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const results: TestResult[] = [];

    for (const suite of raw.suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const result = test.results?.[0] || {};
          results.push({
            title: `${suite.title} > ${spec.title}`,
            status: result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed',
            duration: result.duration || 0,
            error: result.error?.message,
            retries: (test.results?.length || 1) - 1,
            screenshot: result.attachments?.find((a: any) => a.name === 'screenshot')?.path,
          });
        }
      }
    }
    return results;
  }

  private parseJestResults(dir: string): TestResult[] {
    const jsonFile = path.join(dir, 'jest-results.json');
    if (!fs.existsSync(jsonFile)) return [];
    const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const results: TestResult[] = [];
    for (const suite of raw.testResults || []) {
      for (const test of suite.testResults || []) {
        results.push({
          title: test.fullName,
          status: test.status as any,
          duration: test.duration || 0,
          error: test.failureMessages?.[0],
          retries: 0,
        });
      }
    }
    return results;
  }

  private parsePytestResults(dir: string): TestResult[] {
    const jsonFile = path.join(dir, 'pytest-results.json');
    if (!fs.existsSync(jsonFile)) return [];
    const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    return (raw.tests || []).map((t: any) => ({
      title: t.nodeid,
      status: t.outcome === 'passed' ? 'passed' : t.outcome === 'skipped' ? 'skipped' : 'failed',
      duration: Math.round((t.duration || 0) * 1000),
      error: t.call?.longrepr,
      retries: 0,
    }));
  }

  private parseJUnitXml(_dir: string): TestResult[] {
    // Simplified JUnit XML parse for TestNG/Selenium
    return [];
  }

  // ─── Upload Report (stub — implement S3 upload) ───────────────────────────
  async uploadReport(): Promise<string | null> {
    const reportDir = path.join(this.workDir, 'playwright-report');
    if (fs.existsSync(reportDir)) {
      this.log('Uploading HTML report to S3...');
      // TODO: aws s3 sync reportDir to S3 bucket
      // return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/reports/${this.data.runId}/index.html`;
    }
    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getLogs(): string[] { return this.logs; }

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(line);
    logger.info(msg);
  }

  private exec(cmd: string, cwd: string): string {
    try {
      const out = execSync(cmd, { cwd, timeout: 300_000, encoding: 'utf8', stdio: 'pipe' });
      if (out) this.logs.push(out);
      return out;
    } catch (err: any) {
      this.log(`Error: ${err.message}`);
      throw err;
    }
  }

  private execAsync(cmd: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const [bin, ...args] = cmd.split(' ');
      const proc = spawn(bin, args, { cwd, env: { ...process.env }, shell: true });
      proc.stdout.on('data', (d) => this.log(d.toString().trim()));
      proc.stderr.on('data', (d) => this.log(d.toString().trim()));
      proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
          // Non-zero exit from test runner = test failures, not an error
          resolve();
        } else {
          resolve();
        }
      });
      proc.on('error', reject);
    });
  }

  async cleanup(): Promise<void> {
    try {
      fs.rmSync(this.workDir, { recursive: true, force: true });
      this.log('🧹 Workspace cleaned up');
    } catch {
      // ignore cleanup errors
    }
  }
}
