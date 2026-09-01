import { v4 as uuidv4 } from 'uuid';
import { AiJobName } from '../ai/types';
import { WorkflowJob } from '../models/WorkflowJob';
import { aiQueue, AiWorkflowJobData } from './queues';

export class WorkflowOrchestrator {
  async enqueue(input: {
    jobName: AiJobName;
    projectId: string;
    userId: string;
    correlationId?: string;
    entityType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
    testPlanId?: string;
    requirementId?: string;
    scenarioIds?: string[];
    generatedTestId?: string;
    testRunId?: string;
    healingAttemptId?: string;
  }): Promise<WorkflowJob> {
    const correlationId = input.correlationId || uuidv4();
    const workflowJob = await WorkflowJob.create({
      projectId: input.projectId,
      userId: input.userId,
      jobName: input.jobName,
      status: 'queued',
      correlationId,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      payload: input.payload || {},
    });

    const data: AiWorkflowJobData = {
      workflowJobId: workflowJob.id,
      jobName: input.jobName,
      projectId: input.projectId,
      userId: input.userId,
      correlationId,
      testPlanId: input.testPlanId,
      requirementId: input.requirementId,
      scenarioIds: input.scenarioIds,
      generatedTestId: input.generatedTestId,
      testRunId: input.testRunId,
      healingAttemptId: input.healingAttemptId,
    };

    const job = await aiQueue.add(input.jobName, data, {
      jobId: workflowJob.id,
      attempts: 2,
      backoff: { type: 'exponential', delay: 8000 },
    });

    await workflowJob.update({ bullJobId: job.id?.toString() });
    return workflowJob;
  }
}

export const orchestrator = new WorkflowOrchestrator();
export default orchestrator;
