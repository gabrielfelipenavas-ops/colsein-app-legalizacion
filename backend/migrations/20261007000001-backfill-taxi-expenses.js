'use strict';

// Los taxis registrados en Kilometraje se reflejan como gastos (categoría
// 'taxi', enlazados por kilometrage_entry_id) para poder incluirlos en una
// legalización de gastos (rubro TRANSPORTES / Detalle de transporte).
// Esta migración crea el gasto espejo de los taxis ya existentes que aún no
// lo tienen. Los nuevos se crean automáticamente desde la API.
module.exports = {
  async up(queryInterface) {
    const [entries] = await queryInterface.sequelize.query(`
      SELECT ke.id, ke.user_id, ke.fecha, ke.taxis, ke.taxi_tipo, ke.taxi_origen, ke.taxi_destino, ke.taxi_foto
      FROM kilometrage_entries ke
      WHERE ke.taxis > 0
        AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.kilometrage_entry_id = ke.id)
    `);
    if (entries.length === 0) return;

    const concepto = (e) => {
      const tipo = (e.taxi_tipo || 'Taxi').trim();
      const origen = (e.taxi_origen || '').trim();
      const destino = (e.taxi_destino || '').trim();
      const ruta = origen && destino ? `${origen} - ${destino}` : (origen || destino);
      return `${tipo}${ruta ? ' ' + ruta : ''}`.toUpperCase();
    };

    const now = new Date();
    await queryInterface.bulkInsert('expenses', entries.map((e) => ({
      user_id: e.user_id,
      kilometrage_entry_id: e.id,
      categoria: 'taxi',
      fecha: e.fecha,
      establecimiento: concepto(e),
      valor: e.taxis,
      valor_legalizable: e.taxis,
      medio_pago: 'efectivo',
      imagen_url: e.taxi_foto || null,
      validado: false,
      observaciones: 'Registrado desde Kilometraje',
      created_at: now,
      updated_at: now,
    })));
  },

  async down(queryInterface) {
    // Solo se eliminan los gastos espejo que no llegaron a entrar en una legalización
    await queryInterface.sequelize.query(
      'DELETE FROM expenses WHERE kilometrage_entry_id IS NOT NULL AND legalization_id IS NULL'
    );
  },
};
