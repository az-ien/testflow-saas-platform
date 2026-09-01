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
import { ScenarioClassification } from '../ai/types';

export class ScenarioValidation extends Model<
  InferAttributes<ScenarioValidation>,
  InferCreationAttributes<ScenarioValidation>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare scenarioId: ForeignKey<string>;
  declare testPlanId: ForeignKey<string>;
  declare classification: ScenarioClassification;
  declare confidence: CreationOptional<number>;
  declare requirementSupported: CreationOptional<boolean>;
  declare evidenceSupported: CreationOptional<boolean>;
  declare reasons: CreationOptional<string[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ScenarioValidation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    scenarioId: { type: DataTypes.UUID, allowNull: false },
    testPlanId: { type: DataTypes.UUID, allowNull: false },
    classification: { type: DataTypes.STRING(30), allowNull: false },
    confidence: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    requirementSupported: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    evidenceSupported: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    reasons: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'scenario_validations',
    modelName: 'ScenarioValidation',
    indexes: [{ fields: ['scenario_id'] }, { fields: ['test_plan_id'] }, { fields: ['project_id'] }],
  }
);

export default ScenarioValidation;
