'use strict';

// Copia en base de datos de cada archivo subido (facturas, fotos de soporte,
// firmas). El disco de Railway es efímero y se borra en cada redespliegue; la
// base de datos sí es persistente. Ver backend/src/services/fileStore.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stored_files', {
      path: { type: Sequelize.STRING(500), primaryKey: true },
      mime: { type: Sequelize.STRING(100) },
      size: { type: Sequelize.INTEGER },
      data: { type: Sequelize.BLOB('long'), allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stored_files');
  },
};
