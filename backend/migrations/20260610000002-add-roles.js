'use strict';

// Agrega los nuevos roles al tipo ENUM de la columna users.rol.
// (No elimina ni cambia los roles existentes; solo añade nuevos valores.)
module.exports = {
  async up(queryInterface) {
    const nuevos = ['contabilidad', 'gerente_general', 'presidente'];
    for (const rol of nuevos) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_users_rol" ADD VALUE IF NOT EXISTS '${rol}'`
      );
    }
  },

  // PostgreSQL no permite eliminar valores de un ENUM de forma sencilla.
  // El "down" se deja como no-op para no romper datos existentes.
  async down() {
    /* no-op: no se pueden quitar valores de un ENUM en PostgreSQL sin recrear el tipo */
  },
};
