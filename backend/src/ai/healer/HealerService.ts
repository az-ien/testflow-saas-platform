import { AiProvider, GeneratedFile, HealingProposal } from '../types';

export interface FailureEvidence {
  title?: string;
  error?: string;
  stack?: string;
  logs?: string[];
  screenshotPath?: string;
  tracePath?: string;
  videoPath?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  currentSource?: string;
}

const classify = (evidence: FailureEvidence): HealingProposal['category'] => {
  const blob = `${evidence.error || ''} ${evidence.stack || ''} ${(evidence.logs || []).join(' ')}`.toLowerCase();
  if (/assert|expect\(/.test(blob) && !/locator|selector|not found|not visible/.test(blob)) return 'assertion';
  if (/locator|selector|strict mode|not found|not visible/.test(blob)) return 'locator';
  if (/timeout|waiting for/.test(blob)) return 'timing';
  if (/econn|enotfound|net::|5\d\d/.test(blob)) return 'environment';
  if ((evidence.consoleErrors || []).length || (evidence.networkErrors || []).length) return 'application_bug';
  return 'unknown';
};

export class HealerService {
  constructor(private readonly provider: AiProvider) {}

  async analyze(evidence: FailureEvidence): Promise<HealingProposal> {
    const heuristic = this.analyzeDeterministically(evidence);
    if (this.provider.name === 'heuristic') {
      return heuristic;
    }

    try {
      const ai = await this.provider.completeJson<HealingProposal>({
        system: [
          'You are the Playwright Test Healer.',
          'Diagnose the failure from stack traces, screenshots, traces, console and network errors.',
          'Propose the smallest maintainable fix.',
          'Never delete valid assertions to make a test pass.',
          'If the application itself is broken, classify as application_bug and do not weaken the test.',
          'Return JSON matching HealingProposal.',
        ].join(' '),
        user: JSON.stringify({ evidence, heuristic }),
      });
      return {
        ...heuristic,
        ...ai,
        preserveAssertions: true,
        files: ai.files || [],
      };
    } catch {
      return heuristic;
    }
  }

  analyzeDeterministically(evidence: FailureEvidence): HealingProposal {
    const category = classify(evidence);
    const files: GeneratedFile[] = [];
    if (evidence.currentSource && category === 'locator') {
      files.push({
        path: 'proposed-fix.patch',
        content: this.locatorHint(evidence),
        language: 'text',
        kind: 'test',
      });
    }

    const summaries: Record<HealingProposal['category'], string> = {
      locator: 'A locator likely no longer matches the current UI.',
      timing: 'The test did not wait for a ready state using a web-first assertion.',
      assertion: 'An expected value or visibility assertion did not match the application.',
      application_bug: 'Console or network evidence suggests an application defect rather than a weak test.',
      test_data: 'Test data or credentials may be invalid for the current environment.',
      environment: 'The application URL, network, or worker environment appears unavailable.',
      unknown: 'The failure does not yet map to a confident automation-only cause.',
    };

    return {
      rootCause: evidence.error || summaries[category],
      category,
      summary: summaries[category],
      proposedFix:
        category === 'application_bug'
          ? 'Do not change the test. File or confirm an application defect using the console/network evidence.'
          : 'Update the affected locator or wait using Playwright web-first assertions. Keep the original business assertion.',
      files,
      confidence: category === 'unknown' ? 0.35 : 0.7,
      preserveAssertions: true,
    };
  }

  private locatorHint(evidence: FailureEvidence): string {
    return [
      'Proposed healing guidance:',
      `- Failure: ${evidence.error || 'unknown'}`,
      '- Prefer page.getByRole() / getByLabel() / getByTestId().',
      '- Replace brittle CSS/XPath locators.',
      '- Do not remove expect() assertions.',
      evidence.currentSource ? `\nCurrent source:\n${evidence.currentSource.slice(0, 4000)}` : '',
    ].join('\n');
  }
}

export default HealerService;
