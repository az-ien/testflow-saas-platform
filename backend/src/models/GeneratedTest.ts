import {
  DataTypes,
  Model,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import { GeneratedFile, CompileStatus, ExecutionStatus, GitPublishStatus, WorkspaceFileDiff } from '../ai/types';

export type GeneratedTestStatus =
  | 'draft'
  | 'ready'
  | 'pr_opened'
  | 'committed'
  | 'executed'
  | 'failed'
  | 'rejected';

export class GeneratedTest extends Model<
  InferAttributes<GeneratedTest>,
  InferCreationAttributes<GeneratedTest>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare requirementId: ForeignKey<string>;
  declare testPlanId: ForeignKey<string>;
  declare scenarioId: ForeignKey<string>;
  declare framework: CreationOptional<string>;
  declare status: CreationOptional<GeneratedTestStatus>;
  declare files: CreationOptional<GeneratedFile[]>;
  declare compileStatus: CreationOptional<CompileStatus>;
  declare executionStatus: CreationOptional<ExecutionStatus>;
  declare workspacePath: CreationOptional<string | null>;
  declare compileLog: CreationOptional<string | null>;
  declare lastRunId: CreationOptional<string | null>;
  declare workspaceDiff: CreationOptional<WorkspaceFileDiff[]>;
  declare gitStatus: CreationOptional<GitPublishStatus>;
  declare branchName: CreationOptional<string | null>;
  declare pullRequestUrl: CreationOptional<string | null>;
  declare commitSha: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

GeneratedTest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    requirementId: { type: DataTypes.UUID, allowNull: false },
    testPlanId: { type: DataTypes.UUID, allowNull: false },
    scenarioId: { type: DataTypes.UUID, allowNull: false },
    framework: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'playwright' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ready' },
    files: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    compileStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    executionStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    workspacePath: { type: DataTypes.STRING(1000), allowNull: true },
    compileLog: { type: DataTypes.TEXT, allowNull: true },
    lastRunId: { type: DataTypes.UUID, allowNull: true },
    workspaceDiff: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    gitStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'none' },
    branchName: { type: DataTypes.STRING(200), allowNull: true },
    pullRequestUrl: { type: DataTypes.STRING(1000), allowNull: true },
    commitSha: { type: DataTypes.STRING(40), allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'generated_tests',
    modelName: 'GeneratedTest',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['scenario_id'] },
      { fields: ['test_plan_id'] },
      { fields: ['git_status'] },
    ],
  }
);

export default GeneratedTest;
