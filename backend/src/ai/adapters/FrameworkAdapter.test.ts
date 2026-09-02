import { getFrameworkAdapter } from './FrameworkAdapter';

const scenario = {
  scenarioKey: 'REQ-001-SC01',
  title: 'Open app',
  description: 'Open app',
  steps: [{ order: 1, action: 'Open the application' }],
  expectedResult: 'App loads',
  requirementRefs: ['REQ-001'],
  evidenceRefs: [],
  assumptions: [],
  rationale: 'Baseline',
};

describe('framework adapters', () => {
  it('defaults unknown frameworks to Playwright', () => {
    const files = getFrameworkAdapter('jest').generate({
      requirementKey: 'REQ-001',
      requirementTitle: 'Demo',
      scenario,
    });
    expect(files.some((file) => file.path.endsWith('.spec.ts'))).toBe(true);
    expect(files.some((file) => file.path.includes('testflow-quality-gate.yml'))).toBe(true);
  });

  it('generates Cypress files when Cypress is selected', () => {
    const files = getFrameworkAdapter('cypress').generate({
      requirementKey: 'REQ-001',
      requirementTitle: 'Demo',
      scenario,
    });
    expect(files.some((file) => file.path.endsWith('.cy.ts'))).toBe(true);
  });

  it('generates pytest files when pytest is selected', () => {
    const files = getFrameworkAdapter('pytest').generate({
      requirementKey: 'REQ-001',
      requirementTitle: 'Demo',
      scenario,
    });
    expect(files.some((file) => file.path.startsWith('tests/test_'))).toBe(true);
  });
});
