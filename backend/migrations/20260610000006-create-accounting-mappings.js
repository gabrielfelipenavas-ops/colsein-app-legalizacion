'use strict';

// Mapeo contable (categoría de gasto → cuenta NetSuite + concepto + código IVA),
// inferido de los ejemplos del archivo plano. EDITABLE desde la app (Contabilidad).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounting_mappings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      categoria: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      concepto_tributario: { type: Sequelize.STRING(40), defaultValue: 'COMPRAS' },
      cuenta: { type: Sequelize.STRING(30) },
      cuenta_id: { type: Sequelize.STRING(30) },
      codigo_iva: { type: Sequelize.STRING(40) },
      descripcion: { type: Sequelize.STRING(200) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    const now = new Date();
    const m = (categoria, concepto_tributario, cuenta, cuenta_id, codigo_iva, descripcion) =>
      ({ categoria, concepto_tributario, cuenta, cuenta_id, codigo_iva, descripcion, created_at: now, updated_at: now });

    // Valores INFERIDOS de los ejemplos del CSV. Contabilidad debe revisar/ajustar.
    await queryInterface.bulkInsert('accounting_mappings', [
      m('alimentacion', 'SERVICIOS', '525535001', '2521', '', 'Almuerzo/alimentación comercial'),
      m('representacion', 'SERVICIOS', '525535001', '2521', '', 'Gastos de representación'),
      m('alojamiento', 'SERVICIOS', '', '', '', 'Alojamiento (ajustar cuenta)'),
      m('transportes', 'SERVICIOS', '519595006', '1812', '', 'Transportes / movilidad'),
      m('peaje', 'SERVICIOS', '519595006', '1812', '', 'Peajes'),
      m('parqueadero', 'SERVICIOS', '', '', '', 'Parqueaderos (ajustar cuenta)'),
      m('taxi', 'SERVICIOS', '', '', '', 'Taxis / apps (ajustar cuenta)'),
      m('imprevistos', 'COMPRAS', '', '', '', 'Imprevistos (ajustar cuenta)'),
      m('otro', 'COMPRAS', '', '', '', 'Otros gastos (ajustar cuenta)'),
      // Línea especial para el impuesto al consumo (se contabiliza aparte)
      m('__impoconsumo__', 'SERVICIOS', '522505001', '841', '', 'Impuesto al consumo (línea aparte)'),
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accounting_mappings');
  },
};
