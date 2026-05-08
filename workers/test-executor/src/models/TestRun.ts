import {
  DataTypes, Model, CreationOptional,
  InferAttributes, InferCreationAttributes, ForeignKey,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';

export interface TestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  screenshot?: string;
  video?: string;
  retries: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export class TestRun extends Model<InferAttributes<TestRun>, InferCreationAttributes<TestRun>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare status: CreationOptional<string>;
  declare branch: CreationOptional<string>;
  declare commitSha: CreationOptional<string>;
  declare triggeredBy: CreationOptional<string>;
  declare framework: CreationOptional<string>;
  declare testPattern: CreationOptional<string>;
  declare results: CreationOptional<TestResult[]>;
  declare summary: CreationOptional<RunSummary | null>;
  declare logs: CreationOptional<string[]>;
  declare reportUrl: CreationOptional<string | null>;
  declare artifactsUrl: CreationOptional<string | null>;
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
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'queued' },
    branch: { type: DataTypes.STRING, allowNull: true },
    commitSha: { type: DataTypes.STRING, allowNull: true },
    triggeredBy: { type: DataTypes.STRING, defaultValue: 'api' },
    framework: { type: DataTypes.STRING, allowNull: true },
    testPattern: { type: DataTypes.STRING, allowNull: true },
    results: { type: DataTypes.JSONB, defaultValue: [] },
    summary: { type: DataTypes.JSONB, allowNull: true },
    logs: { type: DataTypes.JSONB, defaultValue: [] },
    reportUrl: { type: DataTypes.STRING, allowNull: true },
    artifactsUrl: { type: DataTypes.STRING, allowNull: true },
    workerJobId: { type: DataTypes.STRING, allowNull: true },
    queuedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    durationMs: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'test_runs', modelName: 'TestRun' }
);

export default TestRun;
