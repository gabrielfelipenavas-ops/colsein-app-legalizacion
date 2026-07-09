'use strict';

// Los seeds de demostración insertan filas con IDs explícitos (users 1-5,
// kilometrage_reports 1, etc.) sin avanzar las secuencias de PostgreSQL.
// Resultado: el siguiente INSERT hecho por la aplicación intenta usar un ID ya
// ocupado y falla con violación de llave primaria (p. ej. al crear el sexto
// usuario). Esta migración sincroniza todas las secuencias con el MAX(id) real.
module.exports = {
  async up(queryInterface) {
    const [tables] = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'id'`
    );
    for (const { table_name } of tables) {
      try {
        await queryInterface.sequelize.query(
          `SELECT setval(pg_get_serial_sequence('"${table_name}"','id'),
                  COALESCE((SELECT MAX(id) FROM "${table_name}"), 0) + 1, false)`
        );
      } catch (e) {
        // Tablas sin secuencia (p. ej. SequelizeMeta no tiene id): ignorar
      }
    }
  },

  async down() {
    // Sincronizar secuencias es idempotente y no destruye datos: no hay nada
    // que revertir.
  },
};
