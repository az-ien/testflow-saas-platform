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

export class ScenarioEvidence extends Model<
  InferAttributes<ScenarioEvidence>,
  InferCreationAttributes<ScenarioEvidence>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare requirementId: CreationOptional<string | null>;
  declare testPlanId: CreationOptional<string | null>;
  declare scenarioId: CreationOptional<string | null>;
  declare testRunId: CreationOptional<string | null>;
  declare healingAttemptId: CreationOptional<string | null>;
  declare kind: string;
  declare url: CreationOptional<string | null>;
  declare summary: CreationOptional<string | null>;
  declare artifactPath: CreationOptional<string | null>;
  declare payload: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ScenarioEvidence.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    requirementId: { type: DataTypes.UUID, allowNull: true },
    testPlanId: { type: DataTypes.UUID, allowNull: true },
    scenarioId: { type: DataTypes.UUID, allowNull: true },
    testRunId: { type: DataTypes.UUID, allowNull: true },
    healingAttemptId: { type: DataTypes.UUID, allowNull: true },
    kind: { type: DataTypes.STRING(40), allowNull: false },
    url: { type: DataTypes.STRING(2000), allowNull: true },
    summary: { type: DataTypes.TEXT, allowNull: true },
    artifactPath: { type: DataTypes.STRING(1000), allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'scenario_evidence',
    modelName: 'ScenarioEvidence',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['scenario_id'] },
      { fields: ['test_plan_id'] },
      { fields: ['test_run_id'] },
    ],
  }
);

export default ScenarioEvidence;
