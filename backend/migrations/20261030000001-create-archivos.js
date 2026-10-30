'use strict';

// Copia permanente de los archivos subidos (fotos de facturas, soportes de
// kilometraje, firmas) dentro de la base de datos.
//
// Por qué: en Railway (y plataformas similares) el disco del servidor es
// EFÍMERO: cada redespliegue arranca con un disco vacío y las fotos guardadas
// en UPLOAD_DIR desaparecían, por lo que el PDF de la legalización mostraba
// "Imagen no disponible en el servidor". La base de datos PostgreSQL sí es
// permanente, así que cada archivo subido se guarda también aquí y, cuando el
// disco no lo tiene, se restaura desde esta tabla (ver services/archivos.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('archivos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      // Ruta relativa a UPLOAD_DIR, p. ej. "2026-10/uuid.jpg" o "firmas/firma_3_uuid.png"
      ruta: { type: Sequelize.STRING(500), allowNull: false, unique: true },
      mime: { type: Sequelize.STRING(100), allowNull: true },
      tamano: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      contenido: { type: Sequelize.BLOB, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('archivos');
  },
};
