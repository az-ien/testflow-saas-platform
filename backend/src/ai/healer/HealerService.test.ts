import { HealerService } from './HealerService';
import { HeuristicProvider } from '../providers/HeuristicProvider';

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
  });
});
