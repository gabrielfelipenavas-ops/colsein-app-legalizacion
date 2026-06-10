'use strict';

// Campos de impuestos/servicio/propina del gasto y el valor realmente legalizable.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('expenses', 'impoconsumo', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 });
    await queryInterface.addColumn('expenses', 'servicio', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 });
    await queryInterface.addColumn('expenses', 'propina', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 });
    // valor_legalizable = lo que SÍ cuenta para el reembolso (excluye propina y el
    // excedente de servicio sobre el 10%). Por defecto null → se usa "valor".
    await queryInterface.addColumn('expenses', 'valor_legalizable', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expenses', 'impoconsumo');
    await queryInterface.removeColumn('expenses', 'servicio');
    await queryInterface.removeColumn('expenses', 'propina');
    await queryInterface.removeColumn('expenses', 'valor_legalizable');
  },
};
