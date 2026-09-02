import { User } from './User';
import { Project } from './Project';
import { TestRun } from './TestRun';
import { Subscription } from './Subscription';
import { Requirement } from './Requirement';
import { TestPlan } from './TestPlan';
import { Scenario } from './Scenario';
import { ScenarioEvidence } from './ScenarioEvidence';
import { ScenarioValidation } from './ScenarioValidation';
import { Approval } from './Approval';
import { GeneratedTest } from './GeneratedTest';
import { HealingAttempt } from './HealingAttempt';
import { AiActivity } from './AiActivity';
import { WorkflowJob } from './WorkflowJob';
import { Organization, OrganizationMember } from './Organization';

// ─── Existing SaaS associations ───────────────────────────────────────────────

User.hasMany(Project, { foreignKey: 'userId', as: 'projects', onDelete: 'CASCADE' });
Project.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Organization.belongsTo(User, { foreignKey: 'ownerUserId', as: 'owner' });
Organization.hasMany(OrganizationMember, { foreignKey: 'organizationId', as: 'members', onDelete: 'CASCADE' });
OrganizationMember.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
OrganizationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Project.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Organization.hasMany(Project, { foreignKey: 'organizationId', as: 'projects' });

User.hasOne(Subscription, { foreignKey: 'userId', as: 'subscription', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(TestRun, { foreignKey: 'userId', as: 'testRuns', onDelete: 'CASCADE' });
TestRun.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Project.hasMany(TestRun, { foreignKey: 'projectId', as: 'runs', onDelete: 'CASCADE' });
TestRun.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// ─── AI QE associations ───────────────────────────────────────────────────────

User.hasMany(Requirement, { foreignKey: 'userId', as: 'requirements', onDelete: 'CASCADE' });
Project.hasMany(Requirement, { foreignKey: 'projectId', as: 'requirements', onDelete: 'CASCADE' });
Requirement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Requirement.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Requirement.hasMany(TestPlan, { foreignKey: 'requirementId', as: 'testPlans', onDelete: 'CASCADE' });

User.hasMany(TestPlan, { foreignKey: 'userId', as: 'testPlans', onDelete: 'CASCADE' });
Project.hasMany(TestPlan, { foreignKey: 'projectId', as: 'testPlans', onDelete: 'CASCADE' });
TestPlan.belongsTo(User, { foreignKey: 'userId', as: 'user' });
TestPlan.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
TestPlan.belongsTo(Requirement, { foreignKey: 'requirementId', as: 'requirement' });
TestPlan.hasMany(Scenario, { foreignKey: 'testPlanId', as: 'scenarios', onDelete: 'CASCADE' });

User.hasMany(Scenario, { foreignKey: 'userId', as: 'scenarios', onDelete: 'CASCADE' });
Project.hasMany(Scenario, { foreignKey: 'projectId', as: 'scenarios', onDelete: 'CASCADE' });
Scenario.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Scenario.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Scenario.belongsTo(Requirement, { foreignKey: 'requirementId', as: 'requirement' });
Scenario.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });
Scenario.hasMany(ScenarioEvidence, { foreignKey: 'scenarioId', as: 'evidence', onDelete: 'CASCADE' });
Scenario.hasOne(ScenarioValidation, { foreignKey: 'scenarioId', as: 'validation', onDelete: 'CASCADE' });
Scenario.hasMany(GeneratedTest, { foreignKey: 'scenarioId', as: 'generatedTests', onDelete: 'CASCADE' });
Scenario.hasMany(Approval, { foreignKey: 'scenarioId', as: 'approvals', onDelete: 'CASCADE' });

Requirement.hasMany(Scenario, { foreignKey: 'requirementId', as: 'scenarios', onDelete: 'CASCADE' });

Project.hasMany(ScenarioEvidence, { foreignKey: 'projectId', as: 'evidence', onDelete: 'CASCADE' });
ScenarioEvidence.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ScenarioEvidence.belongsTo(Scenario, { foreignKey: 'scenarioId', as: 'scenario' });
ScenarioEvidence.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });
ScenarioEvidence.belongsTo(TestRun, { foreignKey: 'testRunId', as: 'testRun' });
ScenarioEvidence.belongsTo(HealingAttempt, { foreignKey: 'healingAttemptId', as: 'healingAttempt' });

ScenarioValidation.belongsTo(Scenario, { foreignKey: 'scenarioId', as: 'scenario' });
ScenarioValidation.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });
TestPlan.hasMany(ScenarioValidation, { foreignKey: 'testPlanId', as: 'validations', onDelete: 'CASCADE' });

Project.hasMany(Approval, { foreignKey: 'projectId', as: 'approvals', onDelete: 'CASCADE' });
Approval.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Approval.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Approval.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });
Approval.belongsTo(GeneratedTest, { foreignKey: 'generatedTestId', as: 'generatedTest' });
Approval.belongsTo(HealingAttempt, { foreignKey: 'healingAttemptId', as: 'healingAttempt' });
TestPlan.hasMany(Approval, { foreignKey: 'testPlanId', as: 'approvals', onDelete: 'CASCADE' });

Project.hasMany(GeneratedTest, { foreignKey: 'projectId', as: 'generatedTests', onDelete: 'CASCADE' });
GeneratedTest.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
GeneratedTest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
GeneratedTest.belongsTo(Requirement, { foreignKey: 'requirementId', as: 'requirement' });
GeneratedTest.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });
GeneratedTest.belongsTo(Scenario, { foreignKey: 'scenarioId', as: 'scenario' });
GeneratedTest.hasMany(TestRun, { foreignKey: 'generatedTestId', as: 'runs' });
TestRun.belongsTo(GeneratedTest, { foreignKey: 'generatedTestId', as: 'generatedTest' });
TestRun.belongsTo(Scenario, { foreignKey: 'scenarioId', as: 'scenario' });
TestRun.belongsTo(TestPlan, { foreignKey: 'testPlanId', as: 'testPlan' });

Project.hasMany(HealingAttempt, { foreignKey: 'projectId', as: 'healingAttempts', onDelete: 'CASCADE' });
HealingAttempt.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
HealingAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });
HealingAttempt.belongsTo(TestRun, { foreignKey: 'testRunId', as: 'testRun' });
HealingAttempt.belongsTo(GeneratedTest, { foreignKey: 'generatedTestId', as: 'generatedTest' });
HealingAttempt.belongsTo(Scenario, { foreignKey: 'scenarioId', as: 'scenario' });
TestRun.hasMany(HealingAttempt, { foreignKey: 'testRunId', as: 'healingAttempts' });

Project.hasMany(AiActivity, { foreignKey: 'projectId', as: 'aiActivities', onDelete: 'CASCADE' });
AiActivity.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
AiActivity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Project.hasMany(WorkflowJob, { foreignKey: 'projectId', as: 'workflowJobs', onDelete: 'CASCADE' });
WorkflowJob.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
WorkflowJob.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  Project,
  TestRun,
  Subscription,
  Requirement,
  TestPlan,
  Scenario,
  ScenarioEvidence,
  ScenarioValidation,
  Approval,
  GeneratedTest,
  HealingAttempt,
  AiActivity,
  WorkflowJob,
  Organization,
  OrganizationMember,
};
