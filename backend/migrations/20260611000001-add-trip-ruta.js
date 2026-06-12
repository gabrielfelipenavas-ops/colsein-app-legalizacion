'use strict';

// Geometría de la ruta por calles (para dibujar el recorrido real en el mapa).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trips', 'ruta', { type: Sequelize.JSONB, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('trips', 'ruta');
  },
};
