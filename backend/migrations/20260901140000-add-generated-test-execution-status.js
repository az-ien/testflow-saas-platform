'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('generated_tests', 'compile_status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.addColumn('generated_tests', 'execution_status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.addColumn('generated_tests', 'workspace_path', {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });
    await queryInterface.addColumn('generated_tests', 'compile_log', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('generated_tests', 'last_run_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('generated_tests', 'last_run_id');
    await queryInterface.removeColumn('generated_tests', 'compile_log');
    await queryInterface.removeColumn('generated_tests', 'workspace_path');
    await queryInterface.removeColumn('generated_tests', 'execution_status');
    await queryInterface.removeColumn('generated_tests', 'compile_status');
  },
};
