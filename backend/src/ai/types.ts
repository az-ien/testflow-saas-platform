export type ScenarioClassification = 'VERIFIED' | 'NEEDS_REVIEW' | 'UNSUPPORTED';

export type ApprovalPolicy = 'always' | 'verified_auto' | 'manual_all';

export type RequirementSource =
  | 'user_story'
  | 'acceptance_criteria'
  | 'feature_description'
  | 'github_issue'
  | 'jira_issue'
  | 'plain_text';

export type AiJobName =
  | 'PLAN_TEST'
  | 'EXPLORE_APPLICATION'
  | 'VALIDATE_SCENARIOS'
  | 'GENERATE_TEST'
  | 'ANALYZE_FAILURE'
  | 'HEAL_TEST'
  | 'RE_RUN_TEST';

export type WorkflowJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export interface ScenarioStep {
  order: number;
  action: string;
  expected?: string;
  target?: string;
}

export interface PlannedScenario {
  scenarioKey: string;
  title: string;
  description: string;
  steps: ScenarioStep[];
  expectedResult: string;
  requirementRefs: string[];
  evidenceRefs: string[];
  assumptions: string[];
  rationale: string;
}

export interface ValidationResult {
  classification: ScenarioClassification;
  confidence: number;
  reasons: string[];
  requirementSupported: boolean;
  evidenceSupported: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  kind: 'test' | 'page_object' | 'fixture' | 'test_data' | 'config';
}

export interface RepoInventory {
  framework: string;
  hasPlaywrightConfig: boolean;
  testDir: string;
  pagesDir?: string;
  fixturesDir?: string;
  testDataDir?: string;
  existingPages: string[];
  existingFixtures: string[];
  existingTests: string[];
  packageManager?: string;
}

export interface HealingProposal {
  rootCause: string;
  category: 'locator' | 'timing' | 'assertion' | 'application_bug' | 'test_data' | 'environment' | 'unknown';
  summary: string;
  proposedFix: string;
  files: GeneratedFile[];
  confidence: number;
  preserveAssertions: boolean;
}

export interface InteractiveElement {
  tag: string;
  role?: string;
  name?: string;
  testId?: string;
  type?: string;
  href?: string;
  placeholder?: string;
  text?: string;
  id?: string;
  selector?: string;
  disabled?: boolean;
}

export interface ElementLocator {
  testId?: string;
  role?: string;
  name?: string;
  css?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  id?: string;
}

export type BrowserActionType =
  | 'goto'
  | 'click'
  | 'fill'
  | 'press'
  | 'wait'
  | 'screenshot'
  | 'snapshot';

export interface BrowserAction {
  type: BrowserActionType;
  timestamp: string;
  url?: string;
  locator?: ElementLocator;
  result: 'ok' | 'failed';
  error?: string;
  notes?: string;
  valueRedacted?: boolean;
}

export interface ExploredPage {
  url: string;
  title: string;
  snapshot: string;
  screenshotPath?: string;
  interactiveElements: InteractiveElement[];
  headings: string[];
  reachedBy?: BrowserActionType | 'launch';
}

export interface ExplorationResult {
  startUrl: string;
  pages: ExploredPage[];
  observations: string[];
  consoleMessages: string[];
  networkErrors: string[];
  actionLog?: BrowserAction[];
  authenticated?: boolean;
  loginAttempted?: boolean;
  error?: string;
}

export interface AiCompletionRequest {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}

export interface AiProvider {
  name: string;
  complete(request: AiCompletionRequest): Promise<string>;
  completeJson<T>(request: AiCompletionRequest): Promise<T>;
}
