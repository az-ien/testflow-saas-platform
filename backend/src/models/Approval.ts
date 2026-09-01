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

export class Approval extends Model<InferAttributes<Approval>, InferCreationAttributes<Approval>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare testPlanId: CreationOptional<string | null>;
  declare scenarioId: CreationOptional<string | null>;
  declare generatedTestId: CreationOptional<string | null>;
  declare healingAttemptId: CreationOptional<string | null>;
  declare decision: 'approved' | 'rejected' | 'changes_requested';
  declare scope: CreationOptional<'verified' | 'selected' | 'all' | 'healing'>;
  declare comment: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Approval.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    testPlanId: { type: DataTypes.UUID, allowNull: true },
    scenarioId: { type: DataTypes.UUID, allowNull: true },
    generatedTestId: { type: DataTypes.UUID, allowNull: true },
    healingAttemptId: { type: DataTypes.UUID, allowNull: true },
    decision: { type: DataTypes.STRING(30), allowNull: false },
    scope: { type: DataTypes.STRING(30), allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'approvals',
    modelName: 'Approval',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['test_plan_id'] },
      { fields: ['healing_attempt_id'] },
    ],
  }
);

export default Approval;
