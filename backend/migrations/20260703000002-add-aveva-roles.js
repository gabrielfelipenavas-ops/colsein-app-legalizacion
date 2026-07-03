'use strict';

// Nuevos roles de la línea AVEVA:
//   gerente_aveva        → Gerente AVEVA: aprueba a sus desarrolladores de
//                          negocio; sus propios envíos SOLO los autoriza el
//                          presidente (no la gerencia general).
//   desarrollador_aveva  → Desarrollador de Negocios AVEVA: sus envíos los
//                          aprueba el Gerente AVEVA (o el presidente).
module.exports = {
  async up(queryInterface) {
    const nuevos = ['gerente_aveva', 'desarrollador_aveva'];
    for (const rol of nuevos) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_users_rol" ADD VALUE IF NOT EXISTS '${rol}'`
      );
    }
  },

  // PostgreSQL no permite eliminar valores de un ENUM de forma sencilla.
  async down() {
    /* no-op: no se pueden quitar valores de un ENUM en PostgreSQL sin recrear el tipo */
  },
};
