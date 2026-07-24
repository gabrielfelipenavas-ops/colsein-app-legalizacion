'use strict';

// Firma manuscrita del colaborador: imagen PNG guardada en UPLOAD_DIR/firmas
// con nombre no adivinable. Se estampa en el PDF de la legalización para que
// el colaborador no tenga que imprimir, firmar y escanear el documento.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'firma_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'firma_url');
  },
};
