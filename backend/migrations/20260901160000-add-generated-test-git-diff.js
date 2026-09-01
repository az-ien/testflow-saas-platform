'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('generated_tests', 'workspace_diff', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn('generated_tests', 'git_status', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addIndex('generated_tests', ['git_status'], {
      name: 'generated_tests_git_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('generated_tests', 'generated_tests_git_status_idx');
    await queryInterface.removeColumn('generated_tests', 'git_status');
    await queryInterface.removeColumn('generated_tests', 'workspace_diff');
  },
};
