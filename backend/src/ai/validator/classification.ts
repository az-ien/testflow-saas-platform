import {
  ExplorationResult,
  InteractiveElement,
  PlannedScenario,
  ScenarioClassification,
  ValidationResult,
} from '../types';

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'should', 'must', 'user',
  'able', 'when', 'then', 'into', 'onto', 'will', 'can', 'has', 'have', 'are',
  'was', 'were', 'been', 'being', 'their', 'they', 'them', 'application', 'page',
]);

export const requirementText = (requirement: {
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
}): string => [requirement.title, requirement.description || '', requirement.acceptanceCriteria || ''].join('\n');

export const evidenceText = (exploration: ExplorationResult | null): string => {
  if (!exploration) return '';
  const parts: string[] = [exploration.startUrl, ...exploration.observations];
  for (const page of exploration.pages) {
    parts.push(page.url, page.title, page.snapshot, ...page.headings);
    for (const el of page.interactiveElements) {
      parts.push(el.name || '', el.text || '', el.placeholder || '', el.testId || '', el.role || '');
    }
  }
  return parts.join(' ');
};

export const collectElements = (exploration: ExplorationResult | null): InteractiveElement[] => {
  if (!exploration) return [];
  return exploration.pages.flatMap((page) => page.interactiveElements);
};

const overlapScore = (left: string, right: string): number => {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  a.forEach((token) => {
    if (b.has(token)) hits += 1;
  });
  return hits / Math.min(a.size, 12);
};

const UNSUPPORTED_PATTERNS = [
  /credit.?card/i,
  /payment method/i,
  /discount code/i,
  /promo code/i,
  /email receipt/i,
  /two.?factor/i,
  /sso/i,
  /oauth/i,
];

export const classifyScenario = (
  scenario: PlannedScenario,
  requirement: { title: string; description?: string | null; acceptanceCriteria?: string | null },
  exploration: ExplorationResult | null
): ValidationResult => {
  const req = requirementText(requirement);
  const evidence = evidenceText(exploration);
  const scenarioBlob = [scenario.title, scenario.description, scenario.expectedResult, ...scenario.steps.map((s) => s.action)].join(' ');

  const requirementSupported = overlapScore(scenarioBlob, req) >= 0.25 || scenario.requirementRefs.length > 0;
  const evidenceSupported =
    overlapScore(scenarioBlob, evidence) >= 0.2 ||
    scenario.evidenceRefs.length > 0 ||
    scenario.steps.some((step) => evidence.toLowerCase().includes((step.target || '').toLowerCase()) && (step.target || '').length > 2);

  const inventedUi = UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(scenarioBlob) && !pattern.test(evidence) && !pattern.test(req));
  const unsupportedByBoth = UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(scenarioBlob) && !pattern.test(evidence));

  const reasons: string[] = [];
  if (requirementSupported) reasons.push('Scenario language overlaps the requirement.');
  else reasons.push('Scenario is weakly grounded in the requirement text.');
  if (evidenceSupported) reasons.push('Observed UI evidence supports the described controls or flow.');
  else reasons.push('Application evidence does not clearly show the described UI or flow.');
  if (scenario.assumptions.length) reasons.push(`Assumptions recorded: ${scenario.assumptions.join('; ')}`);

  let classification: ScenarioClassification = 'NEEDS_REVIEW';
  let confidence = 0.5;

  if (inventedUi || (unsupportedByBoth && !evidenceSupported)) {
    classification = 'UNSUPPORTED';
    confidence = 0.9;
    reasons.push('Scenario describes behaviour that was not observed in the application.');
  } else if (requirementSupported && evidenceSupported && scenario.assumptions.length === 0) {
    classification = 'VERIFIED';
    confidence = 0.86;
  } else if (requirementSupported && evidenceSupported) {
    classification = 'NEEDS_REVIEW';
    confidence = 0.7;
    reasons.push('Evidence exists, but assumptions remain.');
  } else if (!requirementSupported && !evidenceSupported) {
    classification = 'UNSUPPORTED';
    confidence = 0.8;
  } else {
    classification = 'NEEDS_REVIEW';
    confidence = 0.55;
  }

  return {
    classification,
    confidence,
    reasons,
    requirementSupported,
    evidenceSupported,
  };
};
