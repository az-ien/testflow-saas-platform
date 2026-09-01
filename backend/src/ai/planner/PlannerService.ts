import { findLoginForm } from '../browser/explorationPolicy';
import {
  collectElements,
  constrainScenarioToEvidence,
  controlEvidenceRef,
  matchElements,
  overlapScore,
  unsupportedFeatureInTextNotInEvidence,
} from '../evidence/matching';
import { requirementText } from '../validator/classification';
import {
  AiProvider,
  ExplorationResult,
  InteractiveElement,
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

const mentionsLogin = (text: string): boolean => /log\s*in|sign\s*in|authenticat/i.test(text);

const PLANNER_SYSTEM = [
  'You are the test planner for an AI Quality Engineering SaaS.',
  'Use only the provided application evidence. Never invent screens, fields, payments, discounts, emails, or selectors.',
  'If a requirement is not visible in the evidence, record it as needing review or unsupported. Do not assume it exists.',
  'Each scenario must include steps, expectedResult, requirementRefs, evidenceRefs (control locators only, not a bare start URL), assumptions, and rationale.',
  'Do not generate automation code. Return JSON { "scenarios": [...] }.',
].join(' ');

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
        system: PLANNER_SYSTEM,
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
                authenticated: input.exploration.authenticated || false,
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
        return ai.scenarios
          .map((scenario, index) => this.normalize(input.requirementKey, scenario, index))
          .map((scenario) => constrainScenarioToEvidence(scenario, input.exploration));
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
    const reqText = requirementText(input);
    const criteria = splitCriteria(input.acceptanceCriteria || '');
    const elements = collectElements(input.exploration);
    const startUrl = input.exploration?.startUrl || input.applicationUrl || '';
    const loginForm = findLoginForm(elements);
    const seenTitles = new Set<string>();

    const push = (scenario: PlannedScenario) => {
      const grounded = constrainScenarioToEvidence(
        this.normalize(input.requirementKey, scenario, scenarios.length),
        input.exploration
      );
      const key = grounded.title.toLowerCase();
      if (seenTitles.has(key)) return;
      seenTitles.add(key);
      scenarios.push(grounded);
    };

    if (loginForm && (mentionsLogin(reqText) || !criteria.length)) {
      const username = loginForm.username;
      const password = loginForm.password;
      const submit = loginForm.submit;
      push({
        scenarioKey: `${input.requirementKey}-SC01`,
        title: 'Login with valid credentials',
        description: 'Authenticate using the observed login form.',
        steps: [
          { order: 1, action: `Open ${startUrl || 'the observed login page'}`, target: startUrl },
          {
            order: 2,
            action: 'Enter valid username',
            target: username ? controlEvidenceRef(username) || username.testId || username.name : undefined,
          },
          {
            order: 3,
            action: 'Enter valid password',
            target: controlEvidenceRef(password) || password.testId,
          },
          {
            order: 4,
            action: `Submit ${submit?.text || submit?.name || 'login'}`,
            target: submit ? controlEvidenceRef(submit) || submit.testId : undefined,
          },
        ],
        expectedResult: 'The authenticated application area is shown.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: [username, password, submit]
          .filter((el): el is InteractiveElement => Boolean(el))
          .map((el) => controlEvidenceRef(el))
          .filter((ref): ref is string => Boolean(ref)),
        assumptions: [],
        rationale:
          'A login form (username, password, submit) was observed during exploration. Test credentials must come from project environment variables.',
      });
    }

    criteria.forEach((line, index) => {
      if (mentionsLogin(line) && loginForm) {
        return;
      }

      const matches = matchElements(line, elements);
      const invented = unsupportedFeatureInTextNotInEvidence(line, input.exploration);

      if (invented && !matches.length) {
        push({
          scenarioKey: `${input.requirementKey}-AC${String(index + 1).padStart(2, '0')}`,
          title: line.slice(0, 120),
          description: line,
          steps: [{ order: 1, action: `Verify: ${line}`, expected: line }],
          expectedResult: `The behaviour described by "${line}" occurs.`,
          requirementRefs: [input.requirementKey],
          evidenceRefs: [],
          assumptions: [],
          rationale: 'Acceptance criterion describes behaviour that was not present in the observed UI.',
        });
        return;
      }

      if (matches.length) {
        const primary = matches[0];
        push({
          scenarioKey: `${input.requirementKey}-AC${String(index + 1).padStart(2, '0')}`,
          title: line.slice(0, 120),
          description: line,
          steps: this.stepsForObservedCriterion(line, startUrl, matches.slice(0, 3)),
          expectedResult: `The behaviour described by "${line}" is visible in the application.`,
          requirementRefs: [input.requirementKey],
          evidenceRefs: matches
            .slice(0, 4)
            .map((el) => controlEvidenceRef(el))
            .filter((ref): ref is string => Boolean(ref)),
          assumptions: [],
          rationale: `Acceptance criterion maps to observed control ${primary.testId || primary.text || primary.name}.`,
        });
        return;
      }

      push({
        scenarioKey: `${input.requirementKey}-AC${String(index + 1).padStart(2, '0')}`,
        title: line.slice(0, 120),
        description: line,
        steps: [
          { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
          { order: 2, action: `Verify: ${line}`, expected: line },
        ],
        expectedResult: `The behaviour described by "${line}" is visible in the application.`,
        requirementRefs: [input.requirementKey],
        evidenceRefs: [],
        assumptions: ['Requires human review; no matching control was observed during exploration.'],
        rationale: 'Acceptance criterion comes from the requirement and was not confirmed by browser evidence.',
      });
    });

    if (!scenarios.length && input.exploration?.pages.length) {
      push({
        scenarioKey: `${input.requirementKey}-SC01`,
        title: 'Observe the application landing page',
        description: requirementText(input),
        steps: [
          { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
          { order: 2, action: 'Observe the landing page and available navigation' },
        ],
        expectedResult: 'The application loads and shows the starting UI that was explored.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: elements
          .slice(0, 5)
          .map((el) => controlEvidenceRef(el))
          .filter((ref): ref is string => Boolean(ref)),
        assumptions: overlapScore(reqText, evidenceTextSafe(input.exploration)) >= 0.2 ? [] : ['Requirement language is only weakly reflected on the landing page.'],
        rationale: 'Baseline scenario limited to the page that was actually explored.',
      });
    }

    if (!scenarios.length) {
      push({
        scenarioKey: `${input.requirementKey}-SC01`,
        title: input.title,
        description: reqText,
        steps: [
          { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
          { order: 2, action: 'Observe the landing page and available navigation' },
        ],
        expectedResult: 'The application loads and shows the starting UI.',
        requirementRefs: [input.requirementKey],
        evidenceRefs: [],
        assumptions: ['No live application evidence was collected.'],
        rationale: 'No browser evidence was available, so this scenario cannot be treated as verified.',
      });
    }

    return scenarios.slice(0, 15);
  }

  private stepsForObservedCriterion(line: string, startUrl: string, matches: InteractiveElement[]): ScenarioStep[] {
    const steps: ScenarioStep[] = [
      { order: 1, action: `Open ${startUrl || 'the application'}`, target: startUrl },
    ];
    matches.forEach((matching, index) => {
      steps.push({
        order: index + 2,
        action: `Interact with ${matching.text || matching.name || matching.testId}`,
        target: controlEvidenceRef(matching) || matching.testId || matching.name,
      });
    });
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

const evidenceTextSafe = (exploration: ExplorationResult): string =>
  [
    ...(exploration.observations || []),
    ...exploration.pages.flatMap((page) => [page.title, page.snapshot, ...(page.headings || [])]),
  ].join(' ');

export const scenarioFileSlug = slug;

export default PlannerService;
