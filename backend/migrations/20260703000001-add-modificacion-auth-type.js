'use strict';

// Nuevo tipo de solicitud de autorización: 'modificacion' — permite pedir
// permiso para modificar una legalización ya enviada. La autoriza un gerente
// o el presidente y, al autorizarse, la legalización vuelve a estado borrador.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_authorization_requests_tipo" ADD VALUE IF NOT EXISTS 'modificacion';`
    );
  },

  async down() {
    // PostgreSQL no permite eliminar valores de un ENUM; se deja sin efecto.
  },
};
