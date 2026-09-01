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

export type Framework = 'playwright' | 'cypress' | 'selenium' | 'pytest' | 'testng' | 'jest' | 'mocha';
export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';

export class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare name: string;
  declare description: CreationOptional<string>;
  declare repoUrl: string;
  declare repoBranch: CreationOptional<string>;
  declare repoProvider: RepoProvider;
  declare repoAccessToken: CreationOptional<string>; // encrypted at rest
  declare framework: Framework;
  declare testPattern: CreationOptional<string>; // e.g. "tests/**/*.spec.ts"
  declare environmentVariables: CreationOptional<Record<string, string>>;
  declare webhookUrl: CreationOptional<string>;
  declare webhookSecret: CreationOptional<string>;
  declare isActive: CreationOptional<boolean>;
  declare totalRuns: CreationOptional<number>;
  declare lastRunAt: CreationOptional<Date | null>;
  declare applicationUrl: CreationOptional<string | null>;
  declare approvalPolicy: CreationOptional<'always' | 'verified_auto' | 'manual_all'>;
  declare autoGenerateOnApprove: CreationOptional<boolean>;
  declare autoCreatePullRequest: CreationOptional<boolean>;
  declare autoHealOnFailure: CreationOptional<boolean>;
  declare explorationMaxPages: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Project.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    repoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    repoBranch: {
      type: DataTypes.STRING(100),
      defaultValue: 'main',
    },
    repoProvider: {
      type: DataTypes.ENUM('github', 'gitlab', 'bitbucket', 'azure_devops'),
      allowNull: false,
    },
    repoAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted PAT or OAuth token for private repos',
    },
    framework: {
      type: DataTypes.ENUM('playwright', 'cypress', 'selenium', 'pytest', 'testng', 'jest', 'mocha'),
      allowNull: false,
    },
    testPattern: {
      type: DataTypes.STRING(300),
      defaultValue: '**/*.spec.ts',
    },
    environmentVariables: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Env vars injected into test runner (encrypted)',
    },
    webhookUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    webhookSecret: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    totalRuns: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    applicationUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'Live application URL used by Playwright MCP / explorer',
    },
    approvalPolicy: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'always',
      comment: 'always | verified_auto | manual_all',
    },
    autoGenerateOnApprove: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    autoCreatePullRequest: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    autoHealOnFailure: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    explorationMaxPages: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'projects',
    modelName: 'Project',
  }
);

export default Project;
