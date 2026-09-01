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
import { WorkflowJobStatus } from '../ai/types';

export type TestPlanStatus =
  | 'queued'
  | 'exploring'
  | 'planning'
  | 'validating'
  | 'awaiting_approval'
  | 'approved'
  | 'generating'
  | 'generated'
  | 'failed'
  | 'cancelled';

export class TestPlan extends Model<InferAttributes<TestPlan>, InferCreationAttributes<TestPlan>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare requirementId: ForeignKey<string>;
  declare status: CreationOptional<TestPlanStatus>;
  declare summary: CreationOptional<string | null>;
  declare correlationId: CreationOptional<string>;
  declare applicationUrl: CreationOptional<string | null>;
  declare explorationError: CreationOptional<string | null>;
  declare scenarioCount: CreationOptional<number>;
  declare verifiedCount: CreationOptional<number>;
  declare needsReviewCount: CreationOptional<number>;
  declare unsupportedCount: CreationOptional<number>;
  declare startedAt: CreationOptional<Date | null>;
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TestPlan.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    requirementId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'queued' },
    summary: { type: DataTypes.TEXT, allowNull: true },
    correlationId: { type: DataTypes.STRING(80), allowNull: false },
    applicationUrl: { type: DataTypes.STRING(1000), allowNull: true },
    explorationError: { type: DataTypes.TEXT, allowNull: true },
    scenarioCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    verifiedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    needsReviewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unsupportedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'test_plans',
    modelName: 'TestPlan',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['requirement_id'] },
      { fields: ['correlation_id'] },
      { fields: ['status'] },
    ],
  }
);

export default TestPlan;
