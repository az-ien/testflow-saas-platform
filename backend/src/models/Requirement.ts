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
import { RequirementSource } from '../ai/types';

export class Requirement extends Model<
  InferAttributes<Requirement>,
  InferCreationAttributes<Requirement>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare key: string;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare acceptanceCriteria: CreationOptional<string | null>;
  declare source: CreationOptional<RequirementSource>;
  declare externalId: CreationOptional<string | null>;
  declare externalUrl: CreationOptional<string | null>;
  declare status: CreationOptional<'draft' | 'ready' | 'planned' | 'archived'>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Requirement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    key: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    acceptanceCriteria: { type: DataTypes.TEXT, allowNull: true },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'plain_text',
    },
    externalId: { type: DataTypes.STRING(120), allowNull: true },
    externalUrl: { type: DataTypes.STRING(1000), allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ready' },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'requirements',
    modelName: 'Requirement',
    indexes: [
      { fields: ['project_id'] },
      { fields: ['user_id'] },
      { unique: true, fields: ['project_id', 'key'] },
    ],
  }
);

export default Requirement;
