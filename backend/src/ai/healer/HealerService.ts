import { AiProvider, GeneratedFile, HealingProposal } from '../types';
import { assertionsPreserved } from './assertions';
import { patchFilesForLocator } from './locatorPatch';
import { parseFailedLocator } from './parseFailure';
import { ReproductionResult } from './FailureReproducer';

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
  files?: GeneratedFile[];
  reproduction?: ReproductionResult;
}

const classifyFromText = (evidence: FailureEvidence): HealingProposal['category'] => {
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
          'Diagnose the failure from stack traces, a live page snapshot, screenshots, traces, console and network errors.',
          'Propose the smallest maintainable locator fix from observed controls.',
          'Never delete or weaken valid assertions to make a test pass.',
          'If the application itself is broken, classify as application_bug and do not weaken the test.',
          'Return JSON matching HealingProposal.',
        ].join(' '),
        user: JSON.stringify({ evidence: { ...evidence, files: undefined }, heuristic }),
      });
      const merged: HealingProposal = {
        ...heuristic,
        ...ai,
        preserveAssertions: true,
        files: heuristic.files,
      };
      if (Array.isArray(ai.files) && ai.files.length && evidence.files?.length) {
        const issues = assertionsPreserved(evidence.files, ai.files);
        if (!issues.length) merged.files = ai.files;
      }
      return merged;
    } catch {
      return heuristic;
    }
  }

  analyzeDeterministically(evidence: FailureEvidence): HealingProposal {
    const reproduction = evidence.reproduction;
    const category = this.classify(evidence, reproduction);
    const files = this.proposeFiles(evidence, category, reproduction);

    const summaries: Record<HealingProposal['category'], string> = {
      locator: reproduction?.suggestedElement
        ? `Observed a replacement control (${reproduction.suggestedElement.testId || reproduction.suggestedElement.text || 'unnamed'}) for a stale locator.`
        : 'A locator likely no longer matches the current UI.',
      timing: 'The control was present but the test did not wait with a web-first assertion.',
      assertion: 'An expected value or visibility assertion did not match the application.',
      application_bug: 'Live page, console, or network evidence suggests an application defect rather than a weak test.',
      test_data: 'Test data or credentials may be invalid for the current environment.',
      environment: 'The application URL, network, or worker environment appears unavailable.',
      unknown: 'The failure does not yet map to a confident automation-only cause.',
    };

    const proposedFix = this.fixText(category, files.length > 0, reproduction);

    return {
      rootCause: evidence.error || summaries[category],
      category,
      summary: summaries[category],
      proposedFix,
      files,
      confidence: this.confidence(category, reproduction, files.length > 0),
      preserveAssertions: true,
      reproduced: Boolean(reproduction?.reachable),
      isolationVerified: false,
      screenshotPath: reproduction?.screenshotPath || evidence.screenshotPath,
    };
  }

  private classify(
    evidence: FailureEvidence,
    reproduction?: ReproductionResult
  ): HealingProposal['category'] {
    if (reproduction) {
      if (!reproduction.reachable) return 'environment';
      if ((reproduction.networkErrors || []).some((line) => /5\d\d/.test(line))
        || (reproduction.consoleMessages || []).some((line) => /uncaught|typeerror/i.test(line))) {
        if (!reproduction.suggestedElement) return 'application_bug';
      }
      if (reproduction.failedLocator && reproduction.locatorFound) return 'timing';
      if (reproduction.failedLocator && !reproduction.locatorFound && reproduction.suggestedElement) {
        return 'locator';
      }
      if (reproduction.failedLocator && !reproduction.locatorFound && !reproduction.suggestedElement) {
        return 'application_bug';
      }
    }
    return classifyFromText(evidence);
  }

  private proposeFiles(
    evidence: FailureEvidence,
    category: HealingProposal['category'],
    reproduction?: ReproductionResult
  ): GeneratedFile[] {
    if (category === 'application_bug' || category === 'environment' || category === 'test_data' || category === 'assertion') {
      return [];
    }
    const files = evidence.files || [];
    if (!files.length) return [];

    const failed = reproduction?.failedLocator || parseFailedLocator(`${evidence.error || ''} ${(evidence.logs || []).join(' ')}`);
    const replacement = reproduction?.suggestedElement;
    if (category === 'locator' && failed && replacement) {
      const patched = patchFilesForLocator(files, failed, replacement);
      if (patched && !patched.issues.length) return patched.files;
      return [];
    }
    return [];
  }

  private fixText(
    category: HealingProposal['category'],
    hasPatch: boolean,
    reproduction?: ReproductionResult
  ): string {
    if (category === 'application_bug') {
      return 'Do not change the test. File or confirm an application defect using the reproduced page, console, and network evidence.';
    }
    if (category === 'environment') {
      return 'Check APP_URL, network access, and worker environment. Do not weaken assertions.';
    }
    if (category === 'test_data') {
      return 'Check TEST_USERNAME / TEST_PASSWORD on the project. Do not change expected behaviour.';
    }
    if (hasPatch && reproduction?.suggestedElement) {
      const id = reproduction.suggestedElement.testId || reproduction.suggestedElement.text || 'observed control';
      return `Replace the stale locator with the observed control (${id}). Keep every original assertion.`;
    }
    if (category === 'timing') {
      return 'Keep the locator. Use a Playwright web-first assertion (toBeVisible) instead of a timeout.';
    }
    return 'Update the affected locator using a control observed on the live page. Keep the original business assertion.';
  }

  private confidence(
    category: HealingProposal['category'],
    reproduction: ReproductionResult | undefined,
    hasPatch: boolean
  ): number {
    if (category === 'unknown') return 0.35;
    if (hasPatch && reproduction?.reachable) return 0.82;
    if (reproduction?.reachable) return 0.7;
    return 0.55;
  }
}

export default HealerService;
