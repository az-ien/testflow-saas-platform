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
import { GeneratedFile, HealingProposal } from '../ai/types';

export type HealingStatus =
  | 'proposed'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'verified'
  | 'failed';

export class HealingAttempt extends Model<
  InferAttributes<HealingAttempt>,
  InferCreationAttributes<HealingAttempt>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare testRunId: ForeignKey<string>;
  declare generatedTestId: CreationOptional<string | null>;
  declare scenarioId: CreationOptional<string | null>;
  declare status: CreationOptional<HealingStatus>;
  declare category: CreationOptional<string | null>;
  declare rootCause: CreationOptional<string | null>;
  declare summary: CreationOptional<string | null>;
  declare proposedFix: CreationOptional<string | null>;
  declare confidence: CreationOptional<number | null>;
  declare files: CreationOptional<GeneratedFile[]>;
  declare analysis: CreationOptional<HealingProposal | Record<string, unknown>>;
  declare pullRequestUrl: CreationOptional<string | null>;
  declare rerunId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

HealingAttempt.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    testRunId: { type: DataTypes.UUID, allowNull: false },
    generatedTestId: { type: DataTypes.UUID, allowNull: true },
    scenarioId: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'proposed' },
    category: { type: DataTypes.STRING(40), allowNull: true },
    rootCause: { type: DataTypes.TEXT, allowNull: true },
    summary: { type: DataTypes.TEXT, allowNull: true },
    proposedFix: { type: DataTypes.TEXT, allowNull: true },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    files: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    analysis: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    pullRequestUrl: { type: DataTypes.STRING(1000), allowNull: true },
    rerunId: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'healing_attempts',
    modelName: 'HealingAttempt',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['test_run_id'] },
      { fields: ['status'] },
    ],
  }
);

export default HealingAttempt;
