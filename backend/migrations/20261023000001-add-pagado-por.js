'use strict';

// ¿Quién pagó el gasto? Permite diferenciar en las legalizaciones (de gastos y
// de kilometraje) los gastos que el colaborador pagó con su propio dinero, los
// que pagó con el anticipo que le giraron y los que pagó directamente la
// empresa (tarjeta de crédito corporativa, cuenta Cabify/app de la empresa).
//
//   personal → lo pagó el colaborador: se le reembolsa.
//   anticipo → lo pagó con el dinero del anticipo: se descuenta en la legalización.
//   empresa  → lo pagó la empresa: NO se reembolsa ni se cruza con el anticipo.
module.exports = {
  async up(queryInterface, Sequelize) {
    const PAGADO_POR = { type: Sequelize.ENUM('personal', 'anticipo', 'empresa'), allowNull: false, defaultValue: 'personal' };
    const MONEY = { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 };

    // Nuevo medio de pago: cuenta corporativa (Cabify / app empresarial)
    await queryInterface.sequelize.query(`ALTER TYPE "enum_expenses_medio_pago" ADD VALUE IF NOT EXISTS 'cuenta_empresa'`);

    await queryInterface.addColumn('expenses', 'pagado_por', PAGADO_POR);
    await queryInterface.addColumn('kilometrage_entries', 'pagado_por', PAGADO_POR);

    // Totales derivados (se recalculan en cada cambio)
    await queryInterface.addColumn('expense_legalizations', 'total_pagado_empresa', MONEY);
    await queryInterface.addColumn('kilometrage_reports', 'total_pagado_empresa', MONEY);
    await queryInterface.addColumn('kilometrage_reports', 'total_pagado_anticipo', MONEY);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('kilometrage_reports', 'total_pagado_anticipo');
    await queryInterface.removeColumn('kilometrage_reports', 'total_pagado_empresa');
    await queryInterface.removeColumn('expense_legalizations', 'total_pagado_empresa');
    await queryInterface.removeColumn('kilometrage_entries', 'pagado_por');
    await queryInterface.removeColumn('expenses', 'pagado_por');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_kilometrage_entries_pagado_por"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expenses_pagado_por"');
    /* 'cuenta_empresa' queda en enum_expenses_medio_pago: PostgreSQL no permite quitar valores de un ENUM */
  },
};
