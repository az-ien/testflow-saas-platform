import { Job } from 'bullmq';
import { getAiProvider } from '../ai/providers';
import { PlannerService } from '../ai/planner/PlannerService';
import { ValidatorService } from '../ai/validator/ValidatorService';
import { GeneratorService } from '../ai/generator/GeneratorService';
import { HealerService } from '../ai/healer/HealerService';
import { ExplorationResult } from '../ai/types';
import { PlaywrightExplorer } from '../mcp/playwright/PlaywrightExplorer';
import { toEvidenceRecords } from '../mcp/playwright/EvidenceCollector';
import { Project } from '../models/Project';
import { Requirement } from '../models/Requirement';
import { TestPlan } from '../models/TestPlan';
import { Scenario } from '../models/Scenario';
import { ScenarioEvidence } from '../models/ScenarioEvidence';
import { ScenarioValidation } from '../models/ScenarioValidation';
import { GeneratedTest } from '../models/GeneratedTest';
import { HealingAttempt } from '../models/HealingAttempt';
import { TestRun } from '../models/TestRun';
import { WorkflowJob } from '../models/WorkflowJob';
import { recordActivity } from '../services/AiAudit';
import githubService from '../services/GitHubService';
import { incrementUsage } from '../services/UsageMeter';
import { orchestrator } from '../orchestration/WorkflowOrchestrator';
import { AiWorkflowJobData } from '../orchestration/queues';
import { runQueue } from '../services/RunQueue';
import { logger } from '../config/logger';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

const provider = getAiProvider();
const planner = new PlannerService(provider);
const validator = new ValidatorService(provider);
const generator = new GeneratorService(provider);
const healer = new HealerService(provider);
const explorer = new PlaywrightExplorer();

const assertOwnedRecord = <T extends { userId: string }>(
  entity: T | null,
  job: AiWorkflowJobData,
  name: string
): T => {
  if (!entity) throw new NotFoundError(name);
  if (entity.userId !== job.userId) {
    throw new ForbiddenError(`${name} isolation check failed`);
  }
  return entity;
};

const assertOwnedProjectRecord = <T extends { userId: string; projectId: string }>(
  entity: T | null,
  job: AiWorkflowJobData,
  name: string
): T => {
  const owned = assertOwnedRecord(entity, job, name);
  if (owned.projectId !== job.projectId) {
    throw new ForbiddenError(`${name} isolation check failed`);
  }
  return owned;
};

const assertProject = (project: Project | null, job: AiWorkflowJobData): Project => {
  const owned = assertOwnedRecord(project, job, 'Project');
  if (owned.id !== job.projectId) {
    throw new ForbiddenError('Project isolation check failed');
  }
  return owned;
};

const markWorkflow = async (job: Job<AiWorkflowJobData>, status: 'running' | 'completed' | 'failed', error?: string) => {
  const workflow = await WorkflowJob.findByPk(job.data.workflowJobId);
  if (!workflow) return;
  if (workflow.userId !== job.data.userId || workflow.projectId !== job.data.projectId) {
    throw new ForbiddenError('Workflow job isolation check failed');
  }
  await workflow.update({
    status,
    attempts: job.attemptsMade,
    error: error || null,
    startedAt: workflow.startedAt || new Date(),
    completedAt: status === 'running' ? null : new Date(),
  });
};

export const processAiJob = async (job: Job<AiWorkflowJobData>): Promise<void> => {
  await markWorkflow(job, 'running');
  try {
    switch (job.data.jobName) {
      case 'EXPLORE_APPLICATION':
        await exploreApplication(job.data);
        break;
      case 'PLAN_TEST':
        await planTests(job.data);
        break;
      case 'VALIDATE_SCENARIOS':
        await validateScenarios(job.data);
        break;
      case 'GENERATE_TEST':
        await generateTests(job.data);
        break;
      case 'ANALYZE_FAILURE':
        await analyzeFailure(job.data);
        break;
      case 'HEAL_TEST':
        await healTest(job.data);
        break;
      case 'RE_RUN_TEST':
        await rerunTest(job.data);
        break;
      default:
        throw new Error(`Unsupported AI job: ${job.data.jobName}`);
    }
    await markWorkflow(job, 'completed');
  } catch (err: any) {
    await markWorkflow(job, 'failed', err.message);
    if (job.data.testPlanId) {
      await TestPlan.update(
        { status: 'failed', explorationError: err.message, completedAt: new Date() },
        { where: { id: job.data.testPlanId, userId: job.data.userId, projectId: job.data.projectId } }
      );
    }
    throw err;
  }
};

const exploreApplication = async (job: AiWorkflowJobData): Promise<void> => {
  const plan = assertOwnedProjectRecord(await TestPlan.findByPk(job.testPlanId), job, 'Test plan');
  const project = assertProject(await Project.findByPk(job.projectId), job);

  await plan.update({ status: 'exploring', startedAt: new Date() });
  await incrementUsage(job.userId, 'exploration');

  const startUrl = plan.applicationUrl || project.applicationUrl;
  let exploration: ExplorationResult = {
    startUrl: startUrl || '',
    pages: [],
    observations: startUrl ? [] : ['No application URL configured; planning will use the requirement only.'],
    consoleMessages: [],
    networkErrors: [],
  };

  if (startUrl) {
    exploration = await explorer.explore({
      startUrl,
      projectId: job.projectId,
      userId: job.userId,
      correlationId: job.correlationId,
      maxPages: project.explorationMaxPages || 6,
      artifactDir: process.env.ARTIFACT_DIR || '/tmp/testflow-artifacts',
    });
  }

  const records = toEvidenceRecords(exploration);
  await ScenarioEvidence.destroy({ where: { testPlanId: plan.id, scenarioId: null } });
  for (const record of records) {
    await ScenarioEvidence.create({
      projectId: job.projectId,
      userId: job.userId,
      requirementId: plan.requirementId,
      testPlanId: plan.id,
      kind: record.kind,
      url: record.url || null,
      summary: record.summary,
      artifactPath: record.artifactPath || null,
      payload: record.payload,
    });
  }

  await plan.update({
    explorationError: exploration.error || null,
    summary: exploration.observations.join(' '),
  });

  await recordActivity({
    projectId: job.projectId,
    userId: job.userId,
    action: 'explore_application',
    entityType: 'test_plan',
    entityId: plan.id,
    correlationId: job.correlationId,
    details: { pages: exploration.pages.length, error: exploration.error || null },
  });

  await orchestrator.enqueue({
    jobName: 'PLAN_TEST',
    projectId: job.projectId,
    userId: job.userId,
    correlationId: job.correlationId,
    testPlanId: plan.id,
    requirementId: plan.requirementId,
    entityType: 'test_plan',
    entityId: plan.id,
  });
};

const loadExploration = async (planId: string, userId: string, projectId: string): Promise<ExplorationResult | null> => {
  const evidence = await ScenarioEvidence.findAll({
    where: { testPlanId: planId, userId, projectId },
  });
  if (!evidence.length) return null;
  const pages = evidence
    .filter((row) => row.kind === 'dom')
    .map((row) => ({
      url: row.url || '',
      title: String((row.payload as any)?.title || ''),
      snapshot: String((row.payload as any)?.snapshot || ''),
      screenshotPath: undefined,
      interactiveElements: ((row.payload as any)?.interactiveElements || []) as ExplorationResult['pages'][0]['interactiveElements'],
      headings: ((row.payload as any)?.headings || []) as string[],
    }));
  const start = evidence.find((row) => row.kind === 'observation' || row.kind === 'url');
  return {
    startUrl: start?.url || '',
    pages,
    observations: evidence.filter((row) => row.kind === 'observation').flatMap((row) => ((row.payload as any)?.observations || []) as string[]),
    consoleMessages: evidence.filter((row) => row.kind === 'console').flatMap((row) => ((row.payload as any)?.messages || []) as string[]),
    networkErrors: evidence.filter((row) => row.kind === 'network').flatMap((row) => ((row.payload as any)?.errors || []) as string[]),
  };
};

const planTests = async (job: AiWorkflowJobData): Promise<void> => {
  const plan = assertOwnedProjectRecord(await TestPlan.findByPk(job.testPlanId), job, 'Test plan');
  const requirement = assertOwnedProjectRecord(await Requirement.findByPk(plan.requirementId), job, 'Requirement');

  await plan.update({ status: 'planning' });
  const exploration = await loadExploration(plan.id, job.userId, job.projectId);
  const scenarios = await planner.plan({
    requirementKey: requirement.key,
    title: requirement.title,
    description: requirement.description,
    acceptanceCriteria: requirement.acceptanceCriteria,
    applicationUrl: plan.applicationUrl,
    exploration,
  });

  await Scenario.destroy({ where: { testPlanId: plan.id, userId: job.userId, projectId: job.projectId } });
  for (const scenario of scenarios) {
    await Scenario.create({
      projectId: job.projectId,
      userId: job.userId,
      requirementId: requirement.id,
      testPlanId: plan.id,
      scenarioKey: scenario.scenarioKey,
      title: scenario.title,
      description: scenario.description,
      steps: scenario.steps,
      expectedResult: scenario.expectedResult,
      rationale: scenario.rationale,
      assumptions: scenario.assumptions,
      status: 'draft',
    });
  }

  await requirement.update({ status: 'planned' });
  await recordActivity({
    projectId: job.projectId,
    userId: job.userId,
    action: 'plan_tests',
    entityType: 'test_plan',
    entityId: plan.id,
    correlationId: job.correlationId,
    details: { scenarioCount: scenarios.length },
  });

  await orchestrator.enqueue({
    jobName: 'VALIDATE_SCENARIOS',
    projectId: job.projectId,
    userId: job.userId,
    correlationId: job.correlationId,
    testPlanId: plan.id,
    requirementId: requirement.id,
    entityType: 'test_plan',
    entityId: plan.id,
  });
};

const validateScenarios = async (job: AiWorkflowJobData): Promise<void> => {
  const plan = assertOwnedProjectRecord(await TestPlan.findByPk(job.testPlanId), job, 'Test plan');
  const requirement = assertOwnedProjectRecord(await Requirement.findByPk(plan.requirementId), job, 'Requirement');
  const project = assertProject(await Project.findByPk(job.projectId), job);
  await plan.update({ status: 'validating' });

  const rows = await Scenario.findAll({ where: { testPlanId: plan.id, userId: job.userId, projectId: job.projectId } });
  const exploration = await loadExploration(plan.id, job.userId, job.projectId);
  const results = await validator.validateScenarios(
    rows.map((row) => ({
      scenarioKey: row.scenarioKey,
      title: row.title,
      description: row.description || '',
      steps: row.steps || [],
      expectedResult: row.expectedResult || '',
      requirementRefs: [requirement.key],
      evidenceRefs: [],
      assumptions: row.assumptions || [],
      rationale: row.rationale || '',
    })),
    requirement,
    exploration
  );

  let verified = 0;
  let needsReview = 0;
  let unsupported = 0;

  for (const row of rows) {
    const result = results.find((item) => item.scenario.scenarioKey === row.scenarioKey);
    if (!result) continue;
    await ScenarioValidation.create({
      projectId: job.projectId,
      userId: job.userId,
      scenarioId: row.id,
      testPlanId: plan.id,
      classification: result.validation.classification,
      confidence: result.validation.confidence,
      requirementSupported: result.validation.requirementSupported,
      evidenceSupported: result.validation.evidenceSupported,
      reasons: result.validation.reasons,
    });

    const nextStatus =
      result.validation.classification === 'UNSUPPORTED'
        ? 'unsupported'
        : 'validated';
    await row.update({
      classification: result.validation.classification,
      confidence: result.validation.confidence,
      status: nextStatus,
    });

    if (result.validation.classification === 'VERIFIED') verified += 1;
    else if (result.validation.classification === 'NEEDS_REVIEW') needsReview += 1;
    else unsupported += 1;
  }

  const autoApproveVerified = project.approvalPolicy === 'verified_auto';
  if (autoApproveVerified) {
    await Scenario.update(
      { status: 'approved' },
      { where: { testPlanId: plan.id, userId: job.userId, classification: 'VERIFIED' } }
    );
  }

  await plan.update({
    status: 'awaiting_approval',
    scenarioCount: rows.length,
    verifiedCount: verified,
    needsReviewCount: needsReview,
    unsupportedCount: unsupported,
    completedAt: new Date(),
    summary: `${verified} verified, ${needsReview} need review, ${unsupported} unsupported`,
  });

  await recordActivity({
    projectId: job.projectId,
    userId: job.userId,
    action: 'validate_scenarios',
    entityType: 'test_plan',
    entityId: plan.id,
    correlationId: job.correlationId,
    details: { verified, needsReview, unsupported },
  });
};

const generateTests = async (job: AiWorkflowJobData): Promise<void> => {
  const plan = assertOwnedProjectRecord(await TestPlan.findByPk(job.testPlanId), job, 'Test plan');
  const requirement = assertOwnedProjectRecord(await Requirement.findByPk(plan.requirementId), job, 'Requirement');
  const project = assertProject(await Project.findByPk(job.projectId), job);
  await plan.update({ status: 'generating' });

  const scenarioWhere: Record<string, unknown> = {
    testPlanId: plan.id,
    userId: job.userId,
    projectId: job.projectId,
    status: 'approved',
  };
  if (job.scenarioIds?.length) {
    scenarioWhere.id = job.scenarioIds;
  }

  const scenarios = await Scenario.findAll({ where: scenarioWhere });
  const inventory = await githubService.inspectRepository(
    project.repoUrl || '',
    project.repoAccessToken,
    project.repoBranch || 'main'
  );

  for (const scenario of scenarios) {
    const files = await generator.generate({
      requirementKey: requirement.key,
      requirementTitle: requirement.title,
      scenario: {
        scenarioKey: scenario.scenarioKey,
        title: scenario.title,
        description: scenario.description || '',
        steps: scenario.steps || [],
        expectedResult: scenario.expectedResult || '',
        requirementRefs: [requirement.key],
        evidenceRefs: [],
        assumptions: scenario.assumptions || [],
        rationale: scenario.rationale || '',
      },
      applicationUrl: plan.applicationUrl || project.applicationUrl,
      inventory,
      framework: project.framework,
    });

    await GeneratedTest.create({
      projectId: job.projectId,
      userId: job.userId,
      requirementId: requirement.id,
      testPlanId: plan.id,
      scenarioId: scenario.id,
      framework: project.framework || 'playwright',
      status: 'ready',
      files,
    });
    await scenario.update({ status: 'generated' });
  }

  await plan.update({ status: 'generated', completedAt: new Date() });
  await recordActivity({
    projectId: job.projectId,
    userId: job.userId,
    action: 'generate_tests',
    entityType: 'test_plan',
    entityId: plan.id,
    correlationId: job.correlationId,
    details: { count: scenarios.length },
  });
};

const analyzeFailure = async (job: AiWorkflowJobData): Promise<void> => {
  const run = assertOwnedProjectRecord(await TestRun.findByPk(job.testRunId), job, 'Test run');
  const failed = (run.results || []).filter((result) => result.status === 'failed');
  const proposal = await healer.analyze({
    title: failed[0]?.title,
    error: failed.map((item) => item.error).filter(Boolean).join('\n') || 'Test run failed',
    logs: run.logs || [],
    screenshotPath: failed[0]?.screenshot,
    videoPath: failed[0]?.video,
  });

  const attempt = await HealingAttempt.create({
    projectId: job.projectId,
    userId: job.userId,
    testRunId: run.id,
    generatedTestId: run.generatedTestId || null,
    scenarioId: run.scenarioId || null,
    status: 'awaiting_approval',
    category: proposal.category,
    rootCause: proposal.rootCause,
    summary: proposal.summary,
    proposedFix: proposal.proposedFix,
    confidence: proposal.confidence,
    files: proposal.files,
    analysis: proposal,
  });

  await incrementUsage(job.userId, 'healing');
  await recordActivity({
    projectId: job.projectId,
    userId: job.userId,
    action: 'analyze_failure',
    entityType: 'healing_attempt',
    entityId: attempt.id,
    correlationId: job.correlationId,
    details: { category: proposal.category, confidence: proposal.confidence },
  });
};

const healTest = async (job: AiWorkflowJobData): Promise<void> => {
  const attempt = assertOwnedProjectRecord(await HealingAttempt.findByPk(job.healingAttemptId), job, 'Healing attempt');
  if (attempt.status !== 'approved') {
    throw new Error('Healing attempt is not approved');
  }

  const project = assertProject(await Project.findByPk(job.projectId), job);

  if (project.autoCreatePullRequest && project.repoUrl && project.repoAccessToken && attempt.files.length) {
    const pr = await githubService.createPullRequest({
      repoUrl: project.repoUrl,
      token: project.repoAccessToken,
      branchName: `testflow/heal-${attempt.id.slice(0, 8)}`,
      baseBranch: project.repoBranch || 'main',
      title: `testflow: heal failing test`,
      body: `${attempt.summary}\n\n${attempt.proposedFix}\n\nThis pull request was opened by TestFlow AI QE after human approval. It does not merge to the default branch.`,
      files: attempt.files,
    });
    await attempt.update({ status: 'applied', pullRequestUrl: pr.pullRequestUrl });
  } else {
    await attempt.update({ status: 'applied' });
  }

  await orchestrator.enqueue({
    jobName: 'RE_RUN_TEST',
    projectId: job.projectId,
    userId: job.userId,
    correlationId: job.correlationId,
    testRunId: attempt.testRunId,
    healingAttemptId: attempt.id,
    entityType: 'healing_attempt',
    entityId: attempt.id,
  });
};

const rerunTest = async (job: AiWorkflowJobData): Promise<void> => {
  const original = assertOwnedProjectRecord(await TestRun.findByPk(job.testRunId), job, 'Test run');
  const project = assertProject(await Project.findByPk(job.projectId), job);

  const run = await TestRun.create({
    projectId: job.projectId,
    userId: job.userId,
    status: 'queued',
    branch: original.branch,
    testPattern: original.testPattern,
    framework: original.framework,
    triggeredBy: 'dashboard',
    triggerSource: 'ai_heal',
    correlationId: job.correlationId,
    testPlanId: original.testPlanId,
    scenarioId: original.scenarioId,
    generatedTestId: original.generatedTestId,
    healingAttemptId: job.healingAttemptId || null,
    queuedAt: new Date(),
  });

  const queued = await runQueue.add('execute-test-run', {
    runId: run.id,
    projectId: project.id,
    userId: job.userId,
    repoUrl: project.repoUrl,
    repoBranch: run.branch || project.repoBranch,
    repoAccessToken: project.repoAccessToken,
    repoProvider: project.repoProvider,
    framework: project.framework,
    testPattern: run.testPattern || project.testPattern,
    environmentVariables: project.environmentVariables,
    webhookUrl: project.webhookUrl,
    webhookSecret: project.webhookSecret,
  });
  await run.update({ workerJobId: queued.id?.toString() });

  if (job.healingAttemptId) {
    await HealingAttempt.update(
      { rerunId: run.id, status: 'verified' },
      { where: { id: job.healingAttemptId, userId: job.userId, projectId: job.projectId } }
    );
  }
};

export const maybeAnalyzeFailure = async (run: TestRun): Promise<void> => {
  if (run.status !== 'failed') return;
  const project = await Project.findByPk(run.projectId);
  if (!project || project.userId !== run.userId) return;
  await orchestrator.enqueue({
    jobName: 'ANALYZE_FAILURE',
    projectId: run.projectId,
    userId: run.userId,
    testRunId: run.id,
    generatedTestId: run.generatedTestId || undefined,
    correlationId: run.correlationId || undefined,
    entityType: 'test_run',
    entityId: run.id,
  });
};

logger.info(`AI processors ready (provider=${provider.name})`);
