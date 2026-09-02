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
import { decryptJson, decryptString, encryptJson, encryptString } from '../services/FieldEncryption';

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
  declare organizationId: CreationOptional<string | null>;
  declare jiraBaseUrl: CreationOptional<string | null>;
  declare jiraProjectKey: CreationOptional<string | null>;
  declare jiraEmail: CreationOptional<string | null>;
  declare jiraApiToken: CreationOptional<string | null>;
  declare aiProvider: CreationOptional<string | null>;
  declare openaiApiKey: CreationOptional<string | null>;
  declare anthropicApiKey: CreationOptional<string | null>;
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
      comment: 'Live application URL used by the Playwright explorer',
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
    organizationId: { type: DataTypes.UUID, allowNull: true },
    jiraBaseUrl: { type: DataTypes.STRING(500), allowNull: true },
    jiraProjectKey: { type: DataTypes.STRING(50), allowNull: true },
    jiraEmail: { type: DataTypes.STRING(255), allowNull: true },
    jiraApiToken: { type: DataTypes.TEXT, allowNull: true },
    aiProvider: { type: DataTypes.STRING(30), allowNull: true },
    openaiApiKey: { type: DataTypes.TEXT, allowNull: true },
    anthropicApiKey: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'projects',
    modelName: 'Project',
    hooks: {
      beforeSave: (project) => {
        if (project.repoAccessToken) project.repoAccessToken = encryptString(project.repoAccessToken) || project.repoAccessToken;
        if (project.webhookSecret) project.webhookSecret = encryptString(project.webhookSecret) || project.webhookSecret;
        if (project.jiraApiToken) project.jiraApiToken = encryptString(project.jiraApiToken) || project.jiraApiToken;
        if (project.openaiApiKey) project.openaiApiKey = encryptString(project.openaiApiKey) || project.openaiApiKey;
        if (project.anthropicApiKey) project.anthropicApiKey = encryptString(project.anthropicApiKey) || project.anthropicApiKey;
        if (project.environmentVariables) {
          project.environmentVariables = encryptJson(project.environmentVariables);
        }
      },
      afterFind: (found) => {
        const rows = Array.isArray(found) ? found : found ? [found] : [];
        for (const project of rows) {
          const row = project as Project;
          row.repoAccessToken = decryptString(row.repoAccessToken) || row.repoAccessToken;
          row.webhookSecret = decryptString(row.webhookSecret) || row.webhookSecret;
          row.jiraApiToken = decryptString(row.jiraApiToken) || row.jiraApiToken;
          row.openaiApiKey = decryptString(row.openaiApiKey) || row.openaiApiKey;
          row.anthropicApiKey = decryptString(row.anthropicApiKey) || row.anthropicApiKey;
          row.environmentVariables = decryptJson(row.environmentVariables);
        }
      },
    },
  }
);

export default Project;
