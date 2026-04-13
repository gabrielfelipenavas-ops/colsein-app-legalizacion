'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── EMAIL MATCHES ──
    await queryInterface.createTable('email_matches', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      expense_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'expenses', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      email_uid: { type: Sequelize.STRING(100), allowNull: false },
      email_subject: Sequelize.STRING(500),
      email_from: Sequelize.STRING(300),
      email_date: Sequelize.DATE,
      nit_extracted: Sequelize.STRING(30),
      valor_extracted: Sequelize.DECIMAL(12, 2),
      numero_factura: Sequelize.STRING(50),
      attachments: { type: Sequelize.JSONB, defaultValue: [] },
      attachment_paths: { type: Sequelize.JSONB, defaultValue: [] },
      match_type: { type: Sequelize.ENUM('auto', 'manual'), allowNull: false, defaultValue: 'manual' },
      confidence: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('email_matches', ['user_id']);
    await queryInterface.addIndex('email_matches', ['email_uid']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_matches');
  },
};
