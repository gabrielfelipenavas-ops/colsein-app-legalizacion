'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trips', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      report_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'kilometrage_reports', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      medio: { type: Sequelize.ENUM('CARRO', 'MOTO'), allowNull: false, defaultValue: 'CARRO' },
      estado: { type: Sequelize.ENUM('en_curso', 'finalizado', 'confirmado'), allowNull: false, defaultValue: 'en_curso' },
      puntos: { type: Sequelize.JSONB, defaultValue: [] },
      legs: { type: Sequelize.JSONB, defaultValue: [] },
      metodo: { type: Sequelize.ENUM('ruta', 'interno'), allowNull: true },
      total_km_estimado: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      total_km_confirmado: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('trips', ['user_id']);
    await queryInterface.addIndex('trips', ['user_id', 'fecha']);
    await queryInterface.addIndex('trips', ['report_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trips');
  },
};
