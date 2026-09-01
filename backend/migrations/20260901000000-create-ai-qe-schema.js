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
    await queryInterface.addColumn('projects', 'application_url', { type: Sequelize.STRING(1000), allowNull: true });
    await queryInterface.addColumn('projects', 'approval_policy', { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'always' });
    await queryInterface.addColumn('projects', 'auto_generate_on_approve', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await queryInterface.addColumn('projects', 'auto_create_pull_request', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn('projects', 'auto_heal_on_failure', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn('projects', 'exploration_max_pages', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 6 });
    await queryInterface.changeColumn('projects', 'repo_url', { type: Sequelize.STRING(500), allowNull: true });

    await queryInterface.addColumn('users', 'monthly_planning_used', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn('users', 'monthly_healing_used', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn('users', 'monthly_exploration_used', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

    await queryInterface.addColumn('test_runs', 'correlation_id', { type: Sequelize.STRING(80), allowNull: true });
    await queryInterface.addColumn('test_runs', 'test_plan_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('test_runs', 'scenario_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('test_runs', 'generated_test_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('test_runs', 'healing_attempt_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('test_runs', 'trigger_source', { type: Sequelize.STRING(40), allowNull: true });

    await queryInterface.createTable('requirements', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      key: { type: Sequelize.STRING(80), allowNull: false },
      title: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      acceptance_criteria: { type: Sequelize.TEXT, allowNull: true },
      source: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'plain_text' },
      external_id: { type: Sequelize.STRING(120), allowNull: true },
      external_url: { type: Sequelize.STRING(1000), allowNull: true },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'ready' },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('requirements', ['project_id']);
    await queryInterface.addIndex('requirements', ['user_id']);
    await queryInterface.addIndex('requirements', ['project_id', 'key'], { unique: true });

    await queryInterface.createTable('test_plans', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      requirement_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'requirements', key: 'id' }, onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'queued' },
      summary: { type: Sequelize.TEXT, allowNull: true },
      correlation_id: { type: Sequelize.STRING(80), allowNull: false },
      application_url: { type: Sequelize.STRING(1000), allowNull: true },
      exploration_error: { type: Sequelize.TEXT, allowNull: true },
      scenario_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      verified_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      needs_review_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      unsupported_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('test_plans', ['project_id']);
    await queryInterface.addIndex('test_plans', ['user_id']);
    await queryInterface.addIndex('test_plans', ['correlation_id']);

    await queryInterface.createTable('scenarios', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      requirement_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'requirements', key: 'id' }, onDelete: 'CASCADE' },
      test_plan_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'test_plans', key: 'id' }, onDelete: 'CASCADE' },
      scenario_key: { type: Sequelize.STRING(80), allowNull: false },
      title: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      steps: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      expected_result: { type: Sequelize.TEXT, allowNull: true },
      rationale: { type: Sequelize.TEXT, allowNull: true },
      assumptions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      classification: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NEEDS_REVIEW' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'draft' },
      confidence: { type: Sequelize.FLOAT, allowNull: true },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('scenarios', ['project_id']);
    await queryInterface.addIndex('scenarios', ['test_plan_id', 'scenario_key'], { unique: true });

    await queryInterface.createTable('scenario_evidence', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      requirement_id: { type: Sequelize.UUID, allowNull: true },
      test_plan_id: { type: Sequelize.UUID, allowNull: true },
      scenario_id: { type: Sequelize.UUID, allowNull: true },
      test_run_id: { type: Sequelize.UUID, allowNull: true },
      healing_attempt_id: { type: Sequelize.UUID, allowNull: true },
      kind: { type: Sequelize.STRING(40), allowNull: false },
      url: { type: Sequelize.STRING(2000), allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      artifact_path: { type: Sequelize.STRING(1000), allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('scenario_evidence', ['project_id']);
    await queryInterface.addIndex('scenario_evidence', ['test_plan_id']);

    await queryInterface.createTable('scenario_validations', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      scenario_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'scenarios', key: 'id' }, onDelete: 'CASCADE' },
      test_plan_id: { type: Sequelize.UUID, allowNull: false },
      classification: { type: Sequelize.STRING(30), allowNull: false },
      confidence: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      requirement_supported: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      evidence_supported: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reasons: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('generated_tests', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      requirement_id: { type: Sequelize.UUID, allowNull: false },
      test_plan_id: { type: Sequelize.UUID, allowNull: false },
      scenario_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'scenarios', key: 'id' }, onDelete: 'CASCADE' },
      framework: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'playwright' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'ready' },
      files: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      branch_name: { type: Sequelize.STRING(200), allowNull: true },
      pull_request_url: { type: Sequelize.STRING(1000), allowNull: true },
      commit_sha: { type: Sequelize.STRING(40), allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('healing_attempts', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      test_run_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'test_runs', key: 'id' }, onDelete: 'CASCADE' },
      generated_test_id: { type: Sequelize.UUID, allowNull: true },
      scenario_id: { type: Sequelize.UUID, allowNull: true },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'proposed' },
      category: { type: Sequelize.STRING(40), allowNull: true },
      root_cause: { type: Sequelize.TEXT, allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      proposed_fix: { type: Sequelize.TEXT, allowNull: true },
      confidence: { type: Sequelize.FLOAT, allowNull: true },
      files: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      analysis: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      pull_request_url: { type: Sequelize.STRING(1000), allowNull: true },
      rerun_id: { type: Sequelize.UUID, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('approvals', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      test_plan_id: { type: Sequelize.UUID, allowNull: true },
      scenario_id: { type: Sequelize.UUID, allowNull: true },
      generated_test_id: { type: Sequelize.UUID, allowNull: true },
      healing_attempt_id: { type: Sequelize.UUID, allowNull: true },
      decision: { type: Sequelize.STRING(30), allowNull: false },
      scope: { type: Sequelize.STRING(30), allowNull: true },
      comment: { type: Sequelize.TEXT, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.createTable('ai_activities', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      actor: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'system' },
      action: { type: Sequelize.STRING(80), allowNull: false },
      entity_type: { type: Sequelize.STRING(40), allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      correlation_id: { type: Sequelize.STRING(80), allowNull: true },
      details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('ai_activities', ['project_id']);
    await queryInterface.addIndex('ai_activities', ['user_id']);
    await queryInterface.addIndex('ai_activities', ['created_at']);

    await queryInterface.createTable('workflow_jobs', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      job_name: { type: Sequelize.STRING(40), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'queued' },
      correlation_id: { type: Sequelize.STRING(80), allowNull: false },
      bull_job_id: { type: Sequelize.STRING(100), allowNull: true },
      entity_type: { type: Sequelize.STRING(40), allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: Sequelize.TEXT, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestampColumns(Sequelize),
    });
    await queryInterface.addIndex('workflow_jobs', ['project_id']);
    await queryInterface.addIndex('workflow_jobs', ['correlation_id']);
    await queryInterface.addIndex('workflow_jobs', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workflow_jobs');
    await queryInterface.dropTable('ai_activities');
    await queryInterface.dropTable('approvals');
    await queryInterface.dropTable('healing_attempts');
    await queryInterface.dropTable('generated_tests');
    await queryInterface.dropTable('scenario_validations');
    await queryInterface.dropTable('scenario_evidence');
    await queryInterface.dropTable('scenarios');
    await queryInterface.dropTable('test_plans');
    await queryInterface.dropTable('requirements');

    await queryInterface.removeColumn('test_runs', 'trigger_source');
    await queryInterface.removeColumn('test_runs', 'healing_attempt_id');
    await queryInterface.removeColumn('test_runs', 'generated_test_id');
    await queryInterface.removeColumn('test_runs', 'scenario_id');
    await queryInterface.removeColumn('test_runs', 'test_plan_id');
    await queryInterface.removeColumn('test_runs', 'correlation_id');
    await queryInterface.removeColumn('users', 'monthly_exploration_used');
    await queryInterface.removeColumn('users', 'monthly_healing_used');
    await queryInterface.removeColumn('users', 'monthly_planning_used');
    await queryInterface.removeColumn('projects', 'exploration_max_pages');
    await queryInterface.removeColumn('projects', 'auto_heal_on_failure');
    await queryInterface.removeColumn('projects', 'auto_create_pull_request');
    await queryInterface.removeColumn('projects', 'auto_generate_on_approve');
    await queryInterface.removeColumn('projects', 'approval_policy');
    await queryInterface.removeColumn('projects', 'application_url');
  },
};
