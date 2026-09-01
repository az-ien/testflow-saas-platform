import {
  collectElements,
  constrainScenarioToEvidence,
  controlCorpus,
  describesUnsupportedFeature,
  isControlEvidenceRef,
  overlapScore,
  targetObserved,
  unsupportedFeatureInTextNotInEvidence,
} from '../evidence/matching';
import {
  ExplorationResult,
  PlannedScenario,
  ScenarioClassification,
  ValidationResult,
} from '../types';

export { collectElements } from '../evidence/matching';

export const requirementText = (requirement: {
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
}): string => [requirement.title, requirement.description || '', requirement.acceptanceCriteria || ''].join('\n');

export const evidenceText = (exploration: ExplorationResult | null): string => controlCorpus(exploration);

const scenarioBlob = (scenario: PlannedScenario): string =>
  [scenario.title, scenario.description, scenario.expectedResult, ...scenario.steps.map((step) => step.action)].join(' ');

const hasObservedControlEvidence = (
  scenario: PlannedScenario,
  exploration: ExplorationResult | null
): boolean => {
  if (!exploration?.pages.length) return false;
  if ((scenario.evidenceRefs || []).some((ref) => isControlEvidenceRef(ref, exploration))) return true;
  if (scenario.steps.some((step) => targetObserved(step.target, exploration) && !/^https?:\/\//i.test(step.target || ''))) {
    return true;
  }
  return overlapScore(scenarioBlob(scenario), controlCorpus(exploration)) >= 0.28;
};

export const classifyScenario = (
  scenario: PlannedScenario,
  requirement: { title: string; description?: string | null; acceptanceCriteria?: string | null },
  exploration: ExplorationResult | null
): ValidationResult => {
  const req = requirementText(requirement);
  const blob = scenarioBlob(scenario);
  const grounded = constrainScenarioToEvidence(scenario, exploration);

  const requirementSupported = overlapScore(blob, req) >= 0.2;
  const evidenceSupported = hasObservedControlEvidence(grounded, exploration);
  const inventedUi = unsupportedFeatureInTextNotInEvidence(blob, exploration);
  const uiAssumptions = (scenario.assumptions || []).filter((item) => !/credential|test data|environment variable/i.test(item));

  const reasons: string[] = [];
  if (requirementSupported) reasons.push('Scenario language overlaps the requirement.');
  else reasons.push('Scenario is weakly grounded in the requirement text.');
  if (evidenceSupported) reasons.push('Observed UI controls support the described flow.');
  else reasons.push('Application evidence does not show the described controls or flow.');
  if ((scenario.evidenceRefs || []).length && !evidenceSupported) {
    reasons.push('Page URLs alone are not treated as proof that a control exists.');
  }
  if (uiAssumptions.length) reasons.push(`Assumptions recorded: ${uiAssumptions.join('; ')}`);

  let classification: ScenarioClassification = 'NEEDS_REVIEW';
  let confidence = 0.5;

  if (inventedUi) {
    classification = 'UNSUPPORTED';
    confidence = 0.92;
    reasons.push('Scenario describes behaviour that was not observed in the application.');
  } else if (!exploration?.pages.length && describesUnsupportedFeature(blob)) {
    classification = 'UNSUPPORTED';
    confidence = 0.85;
    reasons.push('No application evidence was collected for this behaviour.');
  } else if (requirementSupported && evidenceSupported && uiAssumptions.length === 0) {
    classification = 'VERIFIED';
    confidence = 0.88;
  } else if (requirementSupported && evidenceSupported) {
    classification = 'NEEDS_REVIEW';
    confidence = 0.7;
    reasons.push('Evidence exists, but assumptions remain.');
  } else if (!requirementSupported && !evidenceSupported) {
    classification = 'UNSUPPORTED';
    confidence = 0.82;
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
