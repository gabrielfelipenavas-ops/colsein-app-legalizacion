'use strict';

// Índices para las consultas más frecuentes de la app. PostgreSQL no crea
// índices automáticos para claves foráneas; con más de 50 usuarios estas
// tablas se consultan constantemente filtradas por usuario y estado.
module.exports = {
  async up(queryInterface) {
    const addIndexSafe = async (table, fields, name) => {
      try {
        await queryInterface.addIndex(table, fields, { name });
      } catch (err) {
        if (!/already exists/i.test(err.message)) throw err;
      }
    };

    await addIndexSafe('travel_requests', ['user_id'], 'travel_requests_user_id');
    await addIndexSafe('travel_requests', ['estado'], 'travel_requests_estado');
    await addIndexSafe('expense_legalizations', ['user_id'], 'expense_legalizations_user_id');
    await addIndexSafe('expense_legalizations', ['estado'], 'expense_legalizations_estado');
    await addIndexSafe('expense_legalizations', ['travel_request_id'], 'expense_legalizations_travel_request_id');
    await addIndexSafe('approvals', ['tipo', 'referencia_id'], 'approvals_tipo_referencia_id');
    await addIndexSafe('approvals', ['aprobador_id'], 'approvals_aprobador_id');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('travel_requests', 'travel_requests_user_id');
    await queryInterface.removeIndex('travel_requests', 'travel_requests_estado');
    await queryInterface.removeIndex('expense_legalizations', 'expense_legalizations_user_id');
    await queryInterface.removeIndex('expense_legalizations', 'expense_legalizations_estado');
    await queryInterface.removeIndex('expense_legalizations', 'expense_legalizations_travel_request_id');
    await queryInterface.removeIndex('approvals', 'approvals_tipo_referencia_id');
    await queryInterface.removeIndex('approvals', 'approvals_aprobador_id');
  },
};
