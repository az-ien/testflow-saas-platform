import { classifyScenario } from './classification';
import { AiProvider, ExplorationResult, PlannedScenario, ValidationResult } from '../types';

export class ValidatorService {
  constructor(private readonly provider?: AiProvider) {}

  async validateScenarios(
    scenarios: PlannedScenario[],
    requirement: { title: string; description?: string | null; acceptanceCriteria?: string | null },
    exploration: ExplorationResult | null
  ): Promise<Array<{ scenario: PlannedScenario; validation: ValidationResult }>> {
    const deterministic = scenarios.map((scenario) => ({
      scenario,
      validation: classifyScenario(scenario, requirement, exploration),
    }));

    if (!this.provider || this.provider.name === 'heuristic') {
      return deterministic;
    }

    try {
      const ai = await this.provider.completeJson<{
        results?: Array<{ scenarioKey: string; classification: ValidationResult['classification']; reasons?: string[]; confidence?: number }>;
      }>({
        system: [
          'You are the hallucination / evidence validator for an AI quality engineering platform.',
          'Classify each scenario as VERIFIED, NEEDS_REVIEW, or UNSUPPORTED.',
          'VERIFIED requires the requirement and observed UI controls — a start URL is not enough.',
          'NEEDS_REVIEW is for plausible gaps or assumptions.',
          'UNSUPPORTED is for invented UI, payments, discounts, emails, or flows not observed.',
          'Never upgrade UNSUPPORTED to VERIFIED. Return JSON { "results": [...] }.',
        ].join(' '),
        user: JSON.stringify({
          requirement,
          explorationSummary: exploration
            ? {
                startUrl: exploration.startUrl,
                pages: exploration.pages.map((p) => ({ url: p.url, title: p.title, headings: p.headings, elements: p.interactiveElements.slice(0, 40) })),
                observations: exploration.observations,
              }
            : null,
          scenarios,
          deterministic,
        }),
      });

      return deterministic.map((item) => {
        const override = ai.results?.find((row) => row.scenarioKey === item.scenario.scenarioKey);
        if (!override) return item;
        if (item.validation.classification === 'UNSUPPORTED' && override.classification === 'VERIFIED') {
          return item;
        }
        return {
          scenario: item.scenario,
          validation: {
            ...item.validation,
            classification: override.classification,
            reasons: override.reasons?.length ? override.reasons : item.validation.reasons,
            confidence: override.confidence ?? item.validation.confidence,
          },
        };
      });
    } catch {
      return deterministic;
    }
  }
}

export default ValidatorService;
