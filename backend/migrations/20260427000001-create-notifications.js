'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: Sequelize.ENUM('enviado', 'aprobado', 'rechazado', 'comentario', 'info'),
        allowNull: false,
        defaultValue: 'info',
      },
      titulo: { type: Sequelize.STRING(200), allowNull: false },
      mensaje: { type: Sequelize.TEXT, allowNull: false },
      ref_tipo: {
        type: Sequelize.ENUM('kilometraje', 'anticipo', 'legalizacion'),
        allowNull: true,
      },
      ref_id: { type: Sequelize.INTEGER, allowNull: true },
      leida: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      email_enviado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['user_id', 'leida']);
    await queryInterface.addIndex('notifications', ['ref_tipo', 'ref_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
