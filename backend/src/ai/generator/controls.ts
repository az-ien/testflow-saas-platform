import { PlannedScenario, ScenarioStep } from '../types';

export type ControlKind = 'testid' | 'selector' | 'id' | 'name' | 'text' | 'role';

export interface DiscoveredControl {
  key: string;
  kind: ControlKind;
  value: string;
  raw: string;
}

const PREFIX = /^(testid|selector|id|name|text|role):(.+)$/i;

export const toPascal = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('') || 'Generated';

export const toCamel = (value: string): string => {
  const pascal = toPascal(value);
  return pascal[0].toLowerCase() + pascal.slice(1);
};

const looksLikeUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith('page:');

export const parseControlRef = (ref?: string | null): DiscoveredControl | null => {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed || looksLikeUrl(trimmed)) return null;

  const prefixed = trimmed.match(PREFIX);
  if (prefixed) {
    const kind = prefixed[1].toLowerCase() as ControlKind;
    const value = prefixed[2].trim();
    if (!value) return null;
    return { key: toCamel(value), kind, value, raw: trimmed };
  }

  if (/^[a-zA-Z][a-zA-Z0-9_-]{0,80}$/.test(trimmed)) {
    return { key: toCamel(trimmed), kind: 'testid', value: trimmed, raw: trimmed };
  }

  return null;
};

const uniqueKey = (desired: string, used: Set<string>): string => {
  if (!used.has(desired)) return desired;
  let i = 2;
  while (used.has(`${desired}${i}`)) i += 1;
  return `${desired}${i}`;
};

export const collectControls = (scenario: PlannedScenario): DiscoveredControl[] => {
  const refs = [
    ...(scenario.evidenceRefs || []),
    ...scenario.steps.map((step) => step.target).filter(Boolean) as string[],
  ];
  const seen = new Set<string>();
  const usedKeys = new Set<string>();
  const controls: DiscoveredControl[] = [];

  for (const ref of refs) {
    const parsed = parseControlRef(ref);
    if (!parsed) continue;
    const identity = `${parsed.kind}:${parsed.value.toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const key = uniqueKey(parsed.key, usedKeys);
    usedKeys.add(key);
    controls.push({ ...parsed, key });
  }

  return controls;
};

export const controlForStep = (
  step: ScenarioStep,
  controls: DiscoveredControl[]
): DiscoveredControl | undefined => {
  const parsed = parseControlRef(step.target);
  if (!parsed) return undefined;
  return controls.find(
    (control) =>
      control.kind === parsed.kind && control.value.toLowerCase() === parsed.value.toLowerCase()
  ) || controls.find((control) => control.key === parsed.key);
};

export const isPasswordControl = (control: DiscoveredControl, action = ''): boolean =>
  /password/i.test(`${control.key} ${control.value} ${action} ${control.raw}`);

export const isUsernameControl = (control: DiscoveredControl, action = ''): boolean =>
  /user|email|login/i.test(`${control.key} ${control.value} ${action}`) && !isPasswordControl(control, action);

export const playwrightLocatorExpr = (control: DiscoveredControl): string => {
  switch (control.kind) {
    case 'testid': {
      const selector = `[data-testid="${escapeAttr(control.value)}"], [data-test="${escapeAttr(control.value)}"]`;
      return `page.locator('${selector.replace(/'/g, "\\'")}')`;
    }
    case 'selector':
      return `page.locator('${control.value.replace(/'/g, "\\'")}')`;
    case 'id':
      return `page.locator('#${control.value.replace(/'/g, "\\'")}')`;
    case 'name':
      return `page.locator('[name="${escapeAttr(control.value)}"]')`;
    case 'text':
      return `page.getByText(${JSON.stringify(control.value)})`;
    case 'role':
      return `page.getByRole(${JSON.stringify(control.value)} as never)`;
    default:
      return `page.locator(${JSON.stringify(`[data-testid="${escapeAttr(control.value)}"]`)})`;
  }
};

const escapeAttr = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const fillValueExpr = (step: ScenarioStep, control: DiscoveredControl): string => {
  if (isPasswordControl(control, step.action)) return 'credentials.password';
  if (isUsernameControl(control, step.action)) return 'credentials.username';
  return "''";
};

export const classifyStep = (step: ScenarioStep): 'navigate' | 'fill' | 'click' | 'verify' | 'other' => {
  const action = (step.action || '').toLowerCase();
  if (action.startsWith('open') || action.includes('navigate') || action.includes('visit') || action.includes('go to')) {
    return 'navigate';
  }
  if (action.includes('enter') || action.includes('type') || action.includes('fill') || action.includes('input')) {
    return 'fill';
  }
  if (action.includes('click') || action.includes('submit') || action.includes('activate') || action.includes('press')) {
    return 'click';
  }
  if (step.expected || action.startsWith('verify') || action.includes('assert') || action.includes('should see')) {
    return 'verify';
  }
  return 'other';
};
