import { ExplorationResult, InteractiveElement, PlannedScenario } from '../types';

export const UNSUPPORTED_FEATURE_PATTERNS = [
  /credit.?card/i,
  /payment method/i,
  /discount code/i,
  /promo code/i,
  /coupon/i,
  /email receipt/i,
  /email notification/i,
  /two.?factor/i,
  /sso/i,
  /oauth/i,
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'should', 'must', 'user',
  'able', 'when', 'then', 'into', 'onto', 'will', 'can', 'has', 'have', 'are',
  'was', 'were', 'been', 'being', 'their', 'they', 'them', 'application', 'page',
  'valid', 'using', 'using', 'open', 'click', 'enter', 'shown', 'visible',
]);

export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

export const overlapScore = (left: string, right: string): number => {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  a.forEach((token) => {
    if (b.has(token)) hits += 1;
  });
  return hits / Math.min(a.size, 12);
};

export const elementLabel = (el: InteractiveElement): string =>
  `${el.testId || ''} ${el.name || ''} ${el.text || ''} ${el.placeholder || ''} ${el.id || ''} ${el.selector || ''} ${el.role || ''} ${el.type || ''}`.trim();

export const collectElements = (exploration: ExplorationResult | null): InteractiveElement[] => {
  if (!exploration) return [];
  return exploration.pages.flatMap((page) => page.interactiveElements);
};

export const controlCorpus = (exploration: ExplorationResult | null): string => {
  if (!exploration) return '';
  const parts: string[] = [...(exploration.observations || [])];
  for (const page of exploration.pages) {
    parts.push(page.title, page.snapshot, ...(page.headings || []));
    for (const el of page.interactiveElements) {
      parts.push(elementLabel(el));
    }
  }
  return parts.join(' ');
};

export const controlEvidenceRef = (el: InteractiveElement): string | undefined => {
  if (el.testId) return `testid:${el.testId}`;
  if (el.selector) return `selector:${el.selector}`;
  if (el.id) return `id:${el.id}`;
  if (el.name) return `name:${el.name}`;
  if (el.text) return `text:${el.text.slice(0, 80)}`;
  return undefined;
};

export const observedPageUrls = (exploration: ExplorationResult | null): Set<string> => {
  const urls = new Set<string>();
  if (!exploration) return urls;
  if (exploration.startUrl) urls.add(exploration.startUrl);
  for (const page of exploration.pages) {
    if (page.url) urls.add(page.url);
  }
  return urls;
};

const looksLikeUrl = (value: string): boolean => /^https?:\/\//i.test(value) || value.startsWith('page:');

export const isControlEvidenceRef = (ref: string, exploration: ExplorationResult | null): boolean => {
  if (!ref || looksLikeUrl(ref)) return false;
  const elements = collectElements(exploration);
  const raw = ref.replace(/^(testid|selector|id|name|text):/i, '');
  return elements.some((el) => {
    const label = elementLabel(el).toLowerCase();
    const candidates = [el.testId, el.selector, el.id, el.name, el.text, controlEvidenceRef(el)]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return candidates.includes(ref.toLowerCase()) || candidates.includes(raw.toLowerCase()) || label.includes(raw.toLowerCase());
  });
};

export const targetObserved = (target: string | undefined, exploration: ExplorationResult | null): boolean => {
  if (!target || target.length < 2) return false;
  if (looksLikeUrl(target)) return observedPageUrls(exploration).has(target) || observedPageUrls(exploration).has(target.replace(/\/$/, ''));
  return isControlEvidenceRef(target, exploration) || collectElements(exploration).some((el) =>
    elementLabel(el).toLowerCase().includes(target.toLowerCase())
  );
};

export const scoreElementAgainstQuery = (query: string, el: InteractiveElement): number => {
  const label = elementLabel(el);
  const base = overlapScore(query, label);
  const qTokens = tokenize(query);
  const labelLower = label.toLowerCase();
  let bonus = 0;
  qTokens.forEach((token) => {
    if (token.length > 4 && labelLower.includes(token)) bonus += 0.15;
  });
  return Math.min(1, base + bonus);
};

export const matchElements = (query: string, elements: InteractiveElement[]): InteractiveElement[] =>
  elements
    .map((el) => ({ el, score: scoreElementAgainstQuery(query, el) }))
    .filter((row) => row.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.el);

export const describesUnsupportedFeature = (text: string): boolean =>
  UNSUPPORTED_FEATURE_PATTERNS.some((pattern) => pattern.test(text));

export const unsupportedFeatureInTextNotInEvidence = (text: string, exploration: ExplorationResult | null): boolean => {
  const evidence = controlCorpus(exploration);
  return UNSUPPORTED_FEATURE_PATTERNS.some((pattern) => pattern.test(text) && !pattern.test(evidence));
};

export const scenarioMentionsUnsupportedFeature = (scenario: PlannedScenario): boolean => {
  const blob = [scenario.title, scenario.description, scenario.expectedResult, ...scenario.steps.map((step) => step.action)].join(' ');
  return describesUnsupportedFeature(blob);
};

export const constrainScenarioToEvidence = (
  scenario: PlannedScenario,
  exploration: ExplorationResult | null
): PlannedScenario => {
  const controlRefs = (scenario.evidenceRefs || []).filter((ref) => isControlEvidenceRef(ref, exploration));
  const steps = (scenario.steps || []).map((step) => {
    if (!step.target) return step;
    if (targetObserved(step.target, exploration)) return step;
    return { ...step, target: undefined };
  });
  return {
    ...scenario,
    steps,
    evidenceRefs: controlRefs,
  };
};
