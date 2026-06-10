'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('authorization_requests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: { type: Sequelize.ENUM('taxi', 'gasto_especial'), allowNull: false, defaultValue: 'taxi' },
      concepto: { type: Sequelize.STRING(300), allowNull: false },
      monto: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      detalle: { type: Sequelize.TEXT },
      ref_tipo: { type: Sequelize.STRING(30) },
      ref_id: { type: Sequelize.INTEGER },
      estado: { type: Sequelize.ENUM('pendiente', 'autorizado', 'rechazado'), allowNull: false, defaultValue: 'pendiente' },
      autorizado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      comentarios: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('authorization_requests', ['user_id']);
    await queryInterface.addIndex('authorization_requests', ['estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('authorization_requests');
  },
};
