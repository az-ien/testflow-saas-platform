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
import { AiJobName, WorkflowJobStatus } from '../ai/types';

export class WorkflowJob extends Model<InferAttributes<WorkflowJob>, InferCreationAttributes<WorkflowJob>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare jobName: AiJobName;
  declare status: CreationOptional<WorkflowJobStatus>;
  declare correlationId: string;
  declare bullJobId: CreationOptional<string | null>;
  declare entityType: CreationOptional<string | null>;
  declare entityId: CreationOptional<string | null>;
  declare attempts: CreationOptional<number>;
  declare error: CreationOptional<string | null>;
  declare payload: CreationOptional<Record<string, unknown>>;
  declare startedAt: CreationOptional<Date | null>;
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

WorkflowJob.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    jobName: { type: DataTypes.STRING(40), allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'queued' },
    correlationId: { type: DataTypes.STRING(80), allowNull: false },
    bullJobId: { type: DataTypes.STRING(100), allowNull: true },
    entityType: { type: DataTypes.STRING(40), allowNull: true },
    entityId: { type: DataTypes.UUID, allowNull: true },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error: { type: DataTypes.TEXT, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workflow_jobs',
    modelName: 'WorkflowJob',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['correlation_id'] },
      { fields: ['status'] },
      { fields: ['job_name'] },
    ],
  }
);

export default WorkflowJob;
