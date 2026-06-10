'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('establishments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(300), allowNull: false },
      nombre_norm: { type: Sequelize.STRING(300), allowNull: false, unique: true },
      nit: { type: Sequelize.STRING(30) },
      direccion: { type: Sequelize.STRING(300) },
      categoria: { type: Sequelize.STRING(40) },
      veces: { type: Sequelize.INTEGER, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('establishments', ['nombre_norm']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('establishments');
  },
};
