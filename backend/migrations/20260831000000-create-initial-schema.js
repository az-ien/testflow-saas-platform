'use strict';

const timestampColumns = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.fn('NOW'),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.fn('NOW'),
  },
  deleted_at: {
    type: Sequelize.DATE,
    allowNull: true,
  },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      company: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      api_key: {
        type: Sequelize.STRING(64),
        allowNull: true,
        unique: true,
      },
      subscription_tier: {
        type: Sequelize.ENUM('free', 'starter', 'pro', 'business', 'enterprise'),
        allowNull: true,
        defaultValue: 'free',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      is_email_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      password_reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      stripe_customer_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      monthly_runs_used: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      monthly_runs_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 50,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.ENUM('free', 'starter', 'pro', 'business', 'enterprise'),
        allowNull: false,
        defaultValue: 'free',
      },
      status: {
        type: Sequelize.ENUM('active', 'past_due', 'cancelled', 'trialing', 'paused'),
        allowNull: true,
        defaultValue: 'active',
      },
      billing_interval: {
        type: Sequelize.ENUM('monthly', 'yearly'),
        allowNull: true,
        defaultValue: 'monthly',
      },
      stripe_subscription_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      stripe_price_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      current_period_start: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      current_period_end: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancel_at_period_end: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      trial_end: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      monthly_runs_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 50,
      },
      parallel_runners_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      repo_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      repo_branch: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'main',
      },
      repo_provider: {
        type: Sequelize.ENUM('github', 'gitlab', 'bitbucket', 'azure_devops'),
        allowNull: false,
      },
      repo_access_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      framework: {
        type: Sequelize.ENUM('playwright', 'cypress', 'selenium', 'pytest', 'testng', 'jest', 'mocha'),
        allowNull: false,
      },
      test_pattern: {
        type: Sequelize.STRING(300),
        allowNull: true,
        defaultValue: '**/*.spec.ts',
      },
      environment_variables: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      webhook_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      webhook_secret: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      total_runs: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      last_run_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('test_runs', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM(
          'queued',
          'cloning',
          'installing',
          'running',
          'passed',
          'failed',
          'error',
          'cancelled',
          'timeout'
        ),
        allowNull: true,
        defaultValue: 'queued',
      },
      branch: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      commit_sha: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      triggered_by: {
        type: Sequelize.ENUM('api', 'schedule', 'webhook', 'dashboard'),
        allowNull: true,
        defaultValue: 'api',
      },
      framework: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      test_pattern: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      results: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      summary: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      logs: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      report_url: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      artifacts_url: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      worker_job_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      queued_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.fn('NOW'),
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex('users', ['stripe_customer_id']);
    await queryInterface.addIndex('subscriptions', ['stripe_subscription_id']);
    await queryInterface.addIndex('projects', ['user_id']);
    await queryInterface.addIndex('projects', ['is_active']);
    await queryInterface.addIndex('test_runs', ['project_id']);
    await queryInterface.addIndex('test_runs', ['user_id']);
    await queryInterface.addIndex('test_runs', ['status']);
    await queryInterface.addIndex('test_runs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_runs');
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('users');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_test_runs_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_test_runs_triggered_by";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_framework";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_repo_provider";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscriptions_billing_interval";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscriptions_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscriptions_plan_id";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_subscription_tier";');
  },
};
