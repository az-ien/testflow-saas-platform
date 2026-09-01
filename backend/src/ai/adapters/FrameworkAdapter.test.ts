import { getFrameworkAdapter } from './FrameworkAdapter';

describe('framework adapters', () => {
  it('uses Playwright as the first-class agentic adapter', () => {
    const adapter = getFrameworkAdapter('cypress');
    expect(adapter.generate({
      requirementKey: 'REQ-001',
      requirementTitle: 'Demo',
      scenario: {
        scenarioKey: 'REQ-001-SC01',
        title: 'Open app',
        description: 'Open app',
        steps: [{ order: 1, action: 'Open the application' }],
        expectedResult: 'App loads',
        requirementRefs: ['REQ-001'],
        evidenceRefs: [],
        assumptions: [],
        rationale: 'Baseline',
      },
    }).some((file) => file.path.endsWith('.spec.ts'))).toBe(true);
  });
});
