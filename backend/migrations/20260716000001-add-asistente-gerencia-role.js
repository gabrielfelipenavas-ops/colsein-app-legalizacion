'use strict';

// Rol nuevo de revisión:
//   asistente_gerencia → Asistente de Gerencia: ve TODAS las legalizaciones,
//   valida factura por factura que estén bien hechas y marca la legalización
//   como `revisado` (o la devuelve con comentario). NO da la aprobación final
//   (esa sigue en gerencia/presidencia según la jerarquía).
// Además se agrega el valor 'revisado' al ENUM de approvals.estado para dejar
// trazabilidad de las revisiones en la misma tabla de aprobaciones.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_users_rol" ADD VALUE IF NOT EXISTS 'asistente_gerencia'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_approvals_estado" ADD VALUE IF NOT EXISTS 'revisado'`
    );
  },

  // PostgreSQL no permite eliminar valores de un ENUM de forma sencilla.
  async down() {
    /* no-op: no se pueden quitar valores de un ENUM en PostgreSQL sin recrear el tipo */
  },
};
