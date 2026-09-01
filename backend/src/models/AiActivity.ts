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

export class AiActivity extends Model<InferAttributes<AiActivity>, InferCreationAttributes<AiActivity>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare actor: CreationOptional<string>;
  declare action: string;
  declare entityType: CreationOptional<string | null>;
  declare entityId: CreationOptional<string | null>;
  declare correlationId: CreationOptional<string | null>;
  declare details: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiActivity.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    actor: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'system' },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entityType: { type: DataTypes.STRING(40), allowNull: true },
    entityId: { type: DataTypes.UUID, allowNull: true },
    correlationId: { type: DataTypes.STRING(80), allowNull: true },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'ai_activities',
    modelName: 'AiActivity',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { fields: ['created_at'] },
      { fields: ['correlation_id'] },
    ],
  }
);

export default AiActivity;
