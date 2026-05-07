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

export type RunStatus =
  | 'queued'
  | 'cloning'
  | 'installing'
  | 'running'
  | 'passed'
  | 'failed'
  | 'error'
  | 'cancelled'
  | 'timeout';

export interface TestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number; // ms
  error?: string;
  screenshot?: string; // S3 URL
  video?: string;      // S3 URL
  retries: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // ms
}

export class TestRun extends Model<
  InferAttributes<TestRun>,
  InferCreationAttributes<TestRun>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare status: CreationOptional<RunStatus>;
  declare branch: CreationOptional<string>;
  declare commitSha: CreationOptional<string>;
  declare triggeredBy: CreationOptional<'api' | 'schedule' | 'webhook' | 'dashboard'>;
  declare framework: CreationOptional<string>;
  declare testPattern: CreationOptional<string>;
  declare results: CreationOptional<TestResult[]>;
  declare summary: CreationOptional<RunSummary | null>;
  declare logs: CreationOptional<string[]>;
  declare reportUrl: CreationOptional<string | null>;   // HTML report on S3
  declare artifactsUrl: CreationOptional<string | null>; // ZIP of screenshots/videos
  declare workerJobId: CreationOptional<string | null>;
  declare queuedAt: CreationOptional<Date>;
  declare startedAt: CreationOptional<Date | null>;
  declare completedAt: CreationOptional<Date | null>;
  declare durationMs: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TestRun.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        'queued', 'cloning', 'installing', 'running',
        'passed', 'failed', 'error', 'cancelled', 'timeout'
      ),
      defaultValue: 'queued',
    },
    branch: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    commitSha: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    triggeredBy: {
      type: DataTypes.ENUM('api', 'schedule', 'webhook', 'dashboard'),
      defaultValue: 'api',
    },
    framework: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    testPattern: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    results: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of individual test results',
    },
    summary: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    logs: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Streamed log lines from test execution',
    },
    reportUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    artifactsUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    workerJobId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    queuedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    durationMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'test_runs',
    modelName: 'TestRun',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  }
);

export default TestRun;
