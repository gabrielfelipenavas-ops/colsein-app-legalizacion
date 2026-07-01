'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Usuario demo con contraseña conocida (está en el repositorio): nunca en producción.
    if (process.env.NODE_ENV === 'production') {
      console.warn('⛔ Seed de demo bloqueado en producción.');
      return;
    }
    const hash = (pw) => bcrypt.hashSync(pw, 12);

    // Idempotent: skip if user already exists
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'gerente.ventas@colsein.co' LIMIT 1"
    );
    if (existing.length === 0) {
      await queryInterface.bulkInsert('users', [{
        nombre: 'Andrés Felipe Ramírez',
        cedula: '79900100',
        email: 'gerente.ventas@colsein.co',
        password_hash: hash('gerente2026'),
        rol: 'gerente_ventas',
        zona: 'Nacional',
        activo: true,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: 'gerente.ventas@colsein.co' }, {});
  },
};
