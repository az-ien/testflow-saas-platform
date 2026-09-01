import { getFrameworkAdapter } from '../adapters/FrameworkAdapter';
import { generatedFileIssues } from './safety';
import { AiProvider, GeneratedFile, PlannedScenario, RepoInventory } from '../types';

export class GeneratorService {
  constructor(private readonly provider: AiProvider) {}

  async generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
    inventory?: RepoInventory | null;
    framework?: string;
  }): Promise<GeneratedFile[]> {
    const adapter = getFrameworkAdapter(input.framework);
    const baseline = adapter.generate(input);

    if (this.provider.name === 'heuristic') {
      return baseline;
    }

    try {
      const ai = await this.provider.completeJson<{ files: GeneratedFile[] }>({
        system: [
          'You are the Playwright Test Generator for an AI Quality Engineering SaaS.',
          'Generate only approved scenario automation from discovered selectors.',
          'Emit pages/, fixtures/baseTest.ts, test-data/users.ts, tests/*.spec.ts, and playwright.config.ts.',
          'Use locators from scenario evidence refs (testid:, selector:, name:, text:, id:). Never invent controls.',
          'Credentials must come from process.env.TEST_USERNAME and TEST_PASSWORD with no demo fallbacks.',
          'Never use XPath or waitForTimeout. Return JSON { "files": [{path,content,language,kind}] }.',
        ].join(' '),
        user: JSON.stringify({
          requirementKey: input.requirementKey,
          requirementTitle: input.requirementTitle,
          scenario: input.scenario,
          applicationUrl: input.applicationUrl,
          inventory: input.inventory,
          baseline,
        }),
      });
      if (Array.isArray(ai.files) && ai.files.length && generatedFileIssues(ai.files).length === 0) {
        return ai.files;
      }
    } catch {
      // Keep deterministic Playwright output.
    }

    return baseline;
  }
}

export default GeneratorService;
