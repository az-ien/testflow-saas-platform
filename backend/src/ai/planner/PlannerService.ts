import { collectElements, requirementText } from '../validator/classification';
import {
  AiProvider,
  ExplorationResult,
  PlannedScenario,
  ScenarioStep,
} from '../types';

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const splitCriteria = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*+\d.)\s]+/, '').trim())
    .filter((line) => line.length > 8);

export class PlannerService {
  constructor(private readonly provider: AiProvider) {}

  async plan(input: {
    requirementKey: string;
    title: string;
    description?: string | null;
    acceptanceCriteria?: string | null;
    applicationUrl?: string | null;
    exploration: ExplorationResult | null;
  }): Promise<PlannedScenario[]> {
    const heuristic = this.planFromEvidence(input);
    if (this.provider.name === 'heuristic') {
      return heuristic;
    }

    try {
      const ai = await this.provider.completeJson<{ scenarios: PlannedScenario[] }>({
        system: [
          'You are the Playwright Test Planner for an AI Quality Engineering SaaS.',
          'Explore only the provided application evidence. Do not invent screens, fields, payments, or emails.',
          'Each scenario must include steps, expectedResult, requirementRefs, evidenceRefs, assumptions, and rationale.',
          'Do not generate automation code. Return JSON { "scenarios": [...] }.',
        ].join(' '),
        user: JSON.stringify({
          requirement: {
            key: input.requirementKey,
            title: input.title,
            description: input.description,
            acceptanceCriteria: input.acceptanceCriteria,
          },
          applicationUrl: input.applicationUrl,
          exploration: input.exploration
            ? {
                startUrl: input.exploration.startUrl,
                observations: input.exploration.observations,
                pages: input.exploration.pages.map((page) => ({
                  url: page.url,
                  title: page.title,
                  headings: page.headings,
                  interactiveElements: page.interactiveElements.slice(0, 50),
                })),
              }
            : null,
          heuristicSeed: heuristic,
        }),
      });
      if (Array.isArray(ai.scenarios) && ai.scenarios.length) {
        return ai.scenarios.map((scenario, index) => this.normalize(input.requirementKey, scenario, index));
      }
    } catch {
      // Fall through to evidence-based planning.
    }

    return heuristic;
  }

  planFromEvidence(input: {
    requirementKey: string;
    title: string;
    description?: string | null;
    acceptanceCriteria?: string | null;
    applicationUrl?: string | null;
    exploration: ExplorationResult | null;
  }): PlannedScenario[] {
    const scenarios: PlannedScenario[] = [];
    const criteria = splitCriteria(input.acceptanceCriteria || input.description || input.title);
    const elements = collectElements(input.exploration);
    const startUrl = input.exploration?.startUrl || input.applicationUrl || '';

    const login = elements.find((el) => /login|sign in/i.test(`${el.name} ${el.text} ${el.testId}`));
    const username = elements.find((el) => /user|email/i.test(`${el.name} ${el.placeholder} ${el.testId}`));
    const password = elements.find((el) => /password/i.test(`${el.name} ${el.placeholder} ${el.type} ${el.testId}`));
    if (login && (username || password)) {
      scenarios.push(this.normalize(input.requirementKey, {
        scenarioKey: `${input.requirementKey}-SC01`,
        title: 'Login with valid credentials',
        description: 'Authenticate using the observed login form.',
        steps: [
          { order: 1, action: `Open ${startUrl || 'the application login page'}`, target: startUrl },
          { order: 2, action: 'Enter valid username', target: username?.testId || username?.name || 'username' },
          { order: 3, action: 'Enter valid password', target: password?.testId || 'password' },
          { order: 4, action: `Submit ${login.name || login.text || 'login'}`, target: login.testId || login.name },
        ],
        expectedResult: 'The authenticated application area is shown.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: [startUrl].filter(Boolean),
        assumptions: ['Valid credentials are available in project environment variables.'],
        rationale: 'A login form was observed during application exploration.',
      }, 0));
    }

    const cart = elements.find((el) => /cart|add to cart|backpack|product/i.test(`${el.name} ${el.text} ${el.testId}`));
    if (cart) {
      scenarios.push(this.normalize(input.requirementKey, {
        scenarioKey: `${input.requirementKey}-SC02`,
        title: `Use observed control: ${cart.name || cart.text || cart.testId}`,
        description: 'Exercise a primary product or cart control seen in the application.',
        steps: [
          { order: 1, action: 'Start from the observed application page', target: startUrl },
          { order: 2, action: `Activate ${cart.name || cart.text || cart.testId}`, target: cart.testId || cart.name },
        ],
        expectedResult: 'The application responds to the observed control without error.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: [startUrl].filter(Boolean),
        assumptions: [],
        rationale: 'The control was present in the Playwright exploration snapshot.',
      }, scenarios.length));
    }

    criteria.forEach((line, index) => {
      const matching = elements.find((el) =>
        `${el.name} ${el.text} ${el.testId}`.toLowerCase().includes(line.toLowerCase().slice(0, 18))
      );
      scenarios.push(this.normalize(input.requirementKey, {
        scenarioKey: `${input.requirementKey}-AC${String(index + 1).padStart(2, '0')}`,
        title: line.slice(0, 120),
        description: line,
        steps: this.stepsForCriterion(line, startUrl, matching),
        expectedResult: `The behaviour described by "${line}" is visible in the application.`,
        requirementRefs: [input.requirementKey],
        evidenceRefs: matching ? [startUrl] : [],
        assumptions: matching ? [] : ['Requires human review; acceptance criterion is not fully evidenced yet.'],
        rationale: matching
          ? 'Acceptance criterion maps to observed UI evidence.'
          : 'Acceptance criterion comes from the requirement and still needs evidence.',
      }, scenarios.length));
    });

    if (!scenarios.length) {
      scenarios.push(this.normalize(input.requirementKey, {
        scenarioKey: `${input.requirementKey}-SC01`,
        title: input.title,
        description: requirementText(input),
        steps: [
          { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
          { order: 2, action: 'Observe the landing page and available navigation' },
        ],
        expectedResult: 'The application loads and shows the starting UI.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: startUrl ? [startUrl] : [],
        assumptions: input.exploration ? [] : ['No live application evidence was collected.'],
        rationale: 'Baseline smoke scenario created from the requirement.',
      }, 0));
    }

    const unique = new Map<string, PlannedScenario>();
    scenarios.forEach((scenario) => unique.set(scenario.title.toLowerCase(), scenario));
    return [...unique.values()].slice(0, 15);
  }

  private stepsForCriterion(line: string, startUrl: string, matching?: { name?: string; text?: string; testId?: string }): ScenarioStep[] {
    const steps: ScenarioStep[] = [
      { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
    ];
    if (matching) {
      steps.push({
        order: 2,
        action: `Interact with ${matching.name || matching.text || matching.testId}`,
        target: matching.testId || matching.name,
      });
    }
    steps.push({
      order: steps.length + 1,
      action: `Verify: ${line}`,
      expected: line,
    });
    return steps;
  }

  private normalize(requirementKey: string, scenario: PlannedScenario, index: number): PlannedScenario {
    const key = scenario.scenarioKey || `${requirementKey}-SC${String(index + 1).padStart(2, '0')}`;
    return {
      scenarioKey: key,
      title: scenario.title || `Scenario ${index + 1}`,
      description: scenario.description || scenario.title,
      steps: (scenario.steps || []).map((step, stepIndex) => ({
        order: step.order || stepIndex + 1,
        action: step.action,
        expected: step.expected,
        target: step.target,
      })),
      expectedResult: scenario.expectedResult || 'The described user-visible behaviour occurs.',
      requirementRefs: scenario.requirementRefs?.length ? scenario.requirementRefs : [requirementKey],
      evidenceRefs: scenario.evidenceRefs || [],
      assumptions: scenario.assumptions || [],
      rationale: scenario.rationale || 'Generated by the AI planner.',
    };
  }
}

export const scenarioFileSlug = slug;

export default PlannerService;
