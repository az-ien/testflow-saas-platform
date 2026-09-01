import { GeneratorService } from './GeneratorService';
import { HeuristicProvider } from '../providers/HeuristicProvider';

describe('GeneratorService', () => {
  const generator = new GeneratorService(new HeuristicProvider());

  it('generates Playwright files that keep requirement traceability', async () => {
    const files = await generator.generate({
      requirementKey: 'GH-001',
      requirementTitle: 'Successful Product Checkout',
      applicationUrl: 'https://www.saucedemo.com',
      framework: 'playwright',
      scenario: {
        scenarioKey: 'GH-001-SC01',
        title: 'Login with valid credentials',
        description: 'Login',
        steps: [
          { order: 1, action: 'Open the application', target: 'https://www.saucedemo.com' },
          { order: 2, action: 'Enter username', target: 'username' },
          { order: 3, action: 'Click login', target: 'login-button' },
        ],
        expectedResult: 'Products are visible',
        requirementRefs: ['GH-001'],
        evidenceRefs: [],
        assumptions: [],
        rationale: 'Observed login form',
      },
    });

    expect(files.some((file) => file.kind === 'test')).toBe(true);
    expect(files.some((file) => file.kind === 'page_object')).toBe(true);
    const spec = files.find((file) => file.kind === 'test')!;
    expect(spec.content).toContain('@GH-001');
    expect(spec.content).toContain('GH-001-SC01');
    expect(spec.content).not.toMatch(/waitForTimeout/);
    expect(spec.content).not.toContain('secret_sauce');
    expect(spec.content).not.toContain('standard_user');
  });
});
