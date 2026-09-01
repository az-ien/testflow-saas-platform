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
import { ScenarioClassification, ScenarioStep } from '../ai/types';

export type ScenarioStatus =
  | 'draft'
  | 'validated'
  | 'approved'
  | 'rejected'
  | 'generated'
  | 'unsupported';

export class Scenario extends Model<InferAttributes<Scenario>, InferCreationAttributes<Scenario>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare requirementId: ForeignKey<string>;
  declare testPlanId: ForeignKey<string>;
  declare scenarioKey: string;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare steps: CreationOptional<ScenarioStep[]>;
  declare expectedResult: CreationOptional<string | null>;
  declare rationale: CreationOptional<string | null>;
  declare assumptions: CreationOptional<string[]>;
  declare classification: CreationOptional<ScenarioClassification>;
  declare status: CreationOptional<ScenarioStatus>;
  declare confidence: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Scenario.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    requirementId: { type: DataTypes.UUID, allowNull: false },
    testPlanId: { type: DataTypes.UUID, allowNull: false },
    scenarioKey: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    steps: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    expectedResult: { type: DataTypes.TEXT, allowNull: true },
    rationale: { type: DataTypes.TEXT, allowNull: true },
    assumptions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    classification: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NEEDS_REVIEW' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'scenarios',
    modelName: 'Scenario',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['test_plan_id'] },
      { unique: true, fields: ['test_plan_id', 'scenario_key'] },
    ],
  }
);

export default Scenario;
