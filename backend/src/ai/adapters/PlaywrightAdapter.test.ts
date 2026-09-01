import { PlaywrightAdapter } from './PlaywrightAdapter';
import { generatedFileIssues } from '../generator/safety';
import { collectControls, parseControlRef } from '../generator/controls';

describe('PlaywrightAdapter', () => {
  const adapter = new PlaywrightAdapter();
  const scenario = {
    scenarioKey: 'REQ-100-SC01',
    title: 'Login with valid credentials',
    description: 'Sign in with observed controls',
    steps: [
      { order: 1, action: 'Open the application', target: 'https://app.example.test' },
      { order: 2, action: 'Enter username', target: 'testid:username' },
      { order: 3, action: 'Enter password', target: 'testid:password' },
      { order: 4, action: 'Click login', target: 'testid:login-button' },
      { order: 5, action: 'Verify catalog heading', target: 'text:Product catalog' },
    ],
    expectedResult: 'Product catalog is visible',
    requirementRefs: ['REQ-100'],
    evidenceRefs: ['testid:username', 'testid:password', 'testid:login-button', 'text:Product catalog'],
    assumptions: [],
    rationale: 'Observed login form',
  };

  it('parses discovered control refs and ignores URLs', () => {
    expect(parseControlRef('testid:username')?.kind).toBe('testid');
    expect(parseControlRef('https://app.example.test')).toBeNull();
    expect(collectControls(scenario).map((control) => control.value)).toEqual(
      expect.arrayContaining(['username', 'password', 'login-button', 'Product catalog'])
    );
  });

  it('emits a runnable Playwright layout from discovered selectors', () => {
    const files = adapter.generate({
      requirementKey: 'REQ-100',
      requirementTitle: 'Catalog login',
      applicationUrl: 'https://app.example.test',
      scenario,
    });

    expect(generatedFileIssues(files)).toEqual([]);
    expect(files.map((file) => file.kind).sort()).toEqual(
      ['config', 'fixture', 'page_object', 'test', 'test_data'].sort()
    );

    const page = files.find((file) => file.kind === 'page_object')!;
    const spec = files.find((file) => file.kind === 'test')!;
    const fixture = files.find((file) => file.kind === 'fixture')!;
    const data = files.find((file) => file.kind === 'test_data')!;
    const config = files.find((file) => file.kind === 'config')!;

    expect(page.path).toMatch(/^pages\/.+Page\.ts$/);
    expect(page.content).toContain('data-testid="username"');
    expect(page.content).toContain('data-test="username"');
    expect(page.content).toContain('async fillUsername');
    expect(page.content).toContain('async clickLoginButton');
    expect(page.content).toMatch(/this\.username\s*=/);
    expect(spec.content).toContain('await app.fillUsername(credentials.username)');
    expect(spec.content).toContain('await app.fillPassword(credentials.password)');
    expect(spec.content).toContain('await app.clickLoginButton()');
    expect(spec.content).toContain('@REQ-100');
    expect(spec.content).toContain('REQ-100-SC01');
    expect(spec.content).toContain("from '../fixtures/baseTest'");
    expect(fixture.content).toContain("from '@playwright/test'");
    expect(data.content).toContain('process.env.TEST_USERNAME');
    expect(data.content).toContain('process.env.TEST_PASSWORD');
    expect(data.content).not.toContain('secret_sauce');
    expect(data.content).not.toContain('standard_user');
    expect(config.path).toBe('playwright.config.ts');
    expect(config.content).toContain("testDir: './tests'");
    expect(`${page.content}${spec.content}`).not.toMatch(/waitForTimeout/);
    expect(`${page.content}${spec.content}`).not.toMatch(/\.or\(\s*page\.getBy(Role|Label|Placeholder)/);
  });
});
