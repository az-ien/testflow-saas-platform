import { qualityGateWorkflow } from '../ai/generator/qualityGate';

describe('generated workspace quality gate', () => {
  it('uploads Playwright reports and traces and ignores default branches', () => {
    const yaml = qualityGateWorkflow();
    expect(yaml).toContain('playwright-report');
    expect(yaml).toContain('test-results');
    expect(yaml).toContain('branches-ignore');
    expect(yaml).toContain('main');
  });
});
