'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organizations', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      owner_user_id: { type: Sequelize.UUID, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable('organization_members', {
      id: { type: Sequelize.UUID, primaryKey: true },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'member' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('organization_members', ['organization_id', 'user_id'], {
      unique: true,
      name: 'organization_members_org_user_idx',
    });
    await queryInterface.addColumn('users', 'organization_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('projects', 'organization_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('projects', 'jira_base_url', { type: Sequelize.STRING(500), allowNull: true });
    await queryInterface.addColumn('projects', 'jira_project_key', { type: Sequelize.STRING(50), allowNull: true });
    await queryInterface.addColumn('projects', 'jira_email', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('projects', 'jira_api_token', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('projects', 'ai_provider', { type: Sequelize.STRING(30), allowNull: true });
    await queryInterface.addColumn('projects', 'openai_api_key', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('projects', 'anthropic_api_key', { type: Sequelize.TEXT, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('projects', 'anthropic_api_key');
    await queryInterface.removeColumn('projects', 'openai_api_key');
    await queryInterface.removeColumn('projects', 'ai_provider');
    await queryInterface.removeColumn('projects', 'jira_api_token');
    await queryInterface.removeColumn('projects', 'jira_email');
    await queryInterface.removeColumn('projects', 'jira_project_key');
    await queryInterface.removeColumn('projects', 'jira_base_url');
    await queryInterface.removeColumn('projects', 'organization_id');
    await queryInterface.removeColumn('users', 'organization_id');
    await queryInterface.dropTable('organization_members');
    await queryInterface.dropTable('organizations');
  },
};
