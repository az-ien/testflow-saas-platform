import { getFrameworkAdapter } from '../adapters/FrameworkAdapter';
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
          'Generate only approved scenario automation.',
          'Reuse existing Page Objects and fixtures when inventory lists them.',
          'Use getByRole/getByLabel/getByTestId. Never use XPath or waitForTimeout.',
          'Do not restructure the customer repository. Return JSON { "files": [{path,content,language,kind}] }.',
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
      if (Array.isArray(ai.files) && ai.files.length) {
        return ai.files;
      }
    } catch {
      // Keep deterministic Playwright output.
    }

    return baseline;
  }
}

export default GeneratorService;
