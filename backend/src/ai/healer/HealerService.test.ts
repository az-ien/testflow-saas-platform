import { parseFailedLocator } from './parseFailure';
import { assertionsPreserved } from './assertions';
import { patchFilesForLocator } from './locatorPatch';
import { suggestReplacement } from './matchControl';
import { HealerService } from './HealerService';
import { HeuristicProvider } from '../providers/HeuristicProvider';
import { PlaywrightAdapter } from '../adapters/PlaywrightAdapter';

describe('healing helpers', () => {
  it('parses Playwright locator failures', () => {
    expect(parseFailedLocator('waiting for getByTestId("login-button")')?.value).toBe('login-button');
    expect(parseFailedLocator('locator.click: Timeout waiting for locator(\'[data-testid="signin"]\')')?.kind).toBe('testid');
  });

  it('rejects patches that drop assertions', () => {
    const before = [{ path: 'tests/a.spec.ts', content: 'await expect(app.page).not.toHaveTitle(/error/i);', language: 'ts', kind: 'test' as const }];
    const after = [{ path: 'tests/a.spec.ts', content: 'await test.fixme();\n', language: 'ts', kind: 'test' as const }];
    expect(assertionsPreserved(before, after).join(' ')).toMatch(/expect|skip|fixme/i);
  });

  it('patches a stale test id without removing expect calls', () => {
    const files = new PlaywrightAdapter().generate({
      requirementKey: 'REQ-LOGIN',
      requirementTitle: 'Catalog login',
      scenario: {
        scenarioKey: 'REQ-LOGIN-SC01',
        title: 'Login with valid credentials',
        description: 'Sign in',
        steps: [
          { order: 1, action: 'Open the application' },
          { order: 2, action: 'Click login', target: 'testid:login-button' },
        ],
        expectedResult: 'Signed in',
        requirementRefs: ['REQ-LOGIN'],
        evidenceRefs: ['testid:login-button'],
        assumptions: [],
        rationale: 'Observed login',
      },
    });
    const patched = patchFilesForLocator(
      files,
      { kind: 'testid', value: 'login-button', raw: 'login-button' },
      { tag: 'button', testId: 'signin', text: 'Login' }
    );
    expect(patched?.issues).toEqual([]);
    expect(patched?.files.some((file) => file.content.includes('signin'))).toBe(true);
    expect(assertionsPreserved(files, patched!.files)).toEqual([]);
  });

  it('suggests the observed login submit when the recorded test id is gone', () => {
    const suggested = suggestReplacement(
      { kind: 'testid', value: 'login-button', raw: 'login-button' },
      [{ tag: 'button', type: 'submit', testId: 'signin', text: 'Login' }]
    );
    expect(suggested?.testId).toBe('signin');
  });
});

describe('HealerService', () => {
  const healer = new HealerService(new HeuristicProvider());

  it('classifies locator failures and refuses to drop assertions', async () => {
    const proposal = await healer.analyze({
      error: 'locator.click: Timeout: waiting for getByRole("button", { name: "Login" })',
      stack: 'Error: locator not found',
      logs: ['strict mode violation'],
    });
    expect(proposal.category).toBe('locator');
    expect(proposal.preserveAssertions).toBe(true);
    expect(proposal.proposedFix.toLowerCase()).not.toContain('remove the assertion');
  });

  it('treats console/network evidence as a likely application defect', async () => {
    const proposal = await healer.analyze({
      error: 'Checkout failed',
      consoleErrors: ['Uncaught TypeError'],
      networkErrors: ['500 https://example.test/checkout'],
    });
    expect(proposal.category).toBe('application_bug');
    expect(proposal.files).toEqual([]);
  });

  it('proposes a locator patch from a reproduced replacement control', async () => {
    const files = new PlaywrightAdapter().generate({
      requirementKey: 'REQ-LOGIN',
      requirementTitle: 'Catalog login',
      scenario: {
        scenarioKey: 'REQ-LOGIN-SC01',
        title: 'Login with valid credentials',
        description: 'Sign in',
        steps: [
          { order: 1, action: 'Open the application' },
          { order: 2, action: 'Click login', target: 'testid:login-button' },
        ],
        expectedResult: 'Signed in',
        requirementRefs: ['REQ-LOGIN'],
        evidenceRefs: ['testid:login-button'],
        assumptions: [],
        rationale: 'Observed login',
      },
    });
    const proposal = await healer.analyze({
      error: 'waiting for locator(\'[data-testid="login-button"]\')',
      files,
      reproduction: {
        reachable: true,
        loginAttempted: false,
        authenticated: false,
        interactiveElements: [{ tag: 'button', testId: 'signin', text: 'Login', type: 'submit' }],
        consoleMessages: [],
        networkErrors: [],
        failedLocator: { kind: 'testid', value: 'login-button', raw: 'data-testid="login-button"' },
        locatorFound: false,
        suggestedElement: { tag: 'button', testId: 'signin', text: 'Login', type: 'submit' },
      },
    });
    expect(proposal.category).toBe('locator');
    expect(proposal.reproduced).toBe(true);
    expect(proposal.files.some((file) => file.content.includes('signin'))).toBe(true);
    expect(proposal.files.some((file) => /data-testid="login-button"/.test(file.content))).toBe(false);
    expect(assertionsPreserved(files, proposal.files)).toEqual([]);
  });
});
