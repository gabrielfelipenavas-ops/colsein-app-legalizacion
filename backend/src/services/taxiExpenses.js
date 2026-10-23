const db = require('../models');
const { computeLegalizationTotals, pagadoPorDe } = require('./pagos');

// ── Taxis registrados en Kilometraje ↔ gastos de la legalización ──
//
// Un taxi (o Uber, DiDi, etc.) NO es kilometraje recorrido: en el formato
// oficial de "Legalización de Gastos" va en el rubro TRANSPORTES y en el
// "Detalle de transporte" (fecha, concepto, valor). Para que el colaborador
// pueda incluirlo en una legalización, cada registro de kilometraje con taxi
// se refleja como un gasto (tabla expenses, categoría 'taxi') enlazado por
// kilometrage_entry_id. Ese gasto aparece en la lista de gastos y se puede
// seleccionar al crear/editar la legalización.
//
// Regla para no pagar dos veces: mientras el taxi NO esté incluido en una
// legalización, se paga por el reporte de kilometraje (columna OTROS/TAXIS).
// Cuando SÍ se incluye en una legalización, deja de sumar en el reporte de
// kilometraje (ver recalculateKmReport y el Excel de kilometraje).

const LOCKED = ['enviado', 'revisado', 'aprobado'];

// Texto del concepto tal como se imprime en el "Detalle de transporte":
// "TAXI CASA - AEROPUERTO", "UBER HOTEL - AER AMS", etc.
function taxiConcepto(entry) {
  const tipo = (entry.taxi_tipo || 'Taxi').trim();
  const origen = (entry.taxi_origen || '').trim();
  const destino = (entry.taxi_destino || '').trim();
  const ruta = origen && destino ? `${origen} - ${destino}` : (origen || destino);
  return `${tipo}${ruta ? ' ' + ruta : ''}`.toUpperCase();
}

// ¿El gasto pertenece a una legalización ya enviada/revisada/aprobada?
async function isLocked(expense) {
  if (!expense || !expense.legalization_id) return false;
  const leg = await db.ExpenseLegalization.findByPk(expense.legalization_id, { attributes: ['estado'] });
  return !!leg && LOCKED.includes(leg.estado);
}

// Recalcula gasto real y saldos de una legalización (en borrador) cuando
// cambia el valor de uno de sus taxis desde Kilometraje.
async function recalculateLegalizationTotals(legalizationId) {
  if (!legalizationId) return;
  const leg = await db.ExpenseLegalization.findByPk(legalizationId);
  if (!leg || LOCKED.includes(leg.estado)) return;
  const expenses = await db.Expense.findAll({ where: { legalization_id: leg.id } });
  const t = computeLegalizationTotals(expenses, leg.valor_anticipo);
  await leg.update({
    gasto_real_total: t.gasto_real_total,
    total_pagado_empresa: t.total_pagado_empresa,
    pago_favor_empresa: t.pago_favor_empresa,
    pago_favor_empleado: t.pago_favor_empleado,
  });
}

// Crea, actualiza o elimina el gasto espejo de un registro de kilometraje
// según su valor de taxi. Devuelve el gasto resultante (o null).
async function syncTaxiExpense(entry) {
  const existing = await db.Expense.findOne({ where: { kilometrage_entry_id: entry.id } });
  const valor = parseFloat(entry.taxis || 0);

  if (!(valor > 0)) {
    if (existing && !(await isLocked(existing))) {
      const legId = existing.legalization_id;
      await existing.destroy();
      await recalculateLegalizationTotals(legId);
    }
    return null;
  }

  const data = {
    user_id: entry.user_id,
    kilometrage_entry_id: entry.id,
    categoria: 'taxi',
    fecha: entry.fecha,
    establecimiento: taxiConcepto(entry),
    valor,
    valor_legalizable: valor,
    imagen_url: entry.taxi_foto || null,
    observaciones: 'Registrado desde Kilometraje',
    // Quién pagó se hereda del registro de kilometraje. Si lo pagó la empresa,
    // el medio típico es la cuenta corporativa (Cabify / app de la empresa).
    pagado_por: pagadoPorDe(entry),
    ...(pagadoPorDe(entry) === 'empresa' ? { medio_pago: 'cuenta_empresa' } : {}),
  };

  if (!existing) return db.Expense.create(data);
  // Si ya está dentro de una legalización bloqueada no se tocan sus valores
  // (el documento enviado debe quedar tal como se aprobó).
  if (await isLocked(existing)) return existing;
  await existing.update(data);
  await recalculateLegalizationTotals(existing.legalization_id);
  return existing;
}

// Antes de borrar un registro de kilometraje: borra su gasto espejo salvo
// que ya forme parte de una legalización bloqueada (en ese caso solo se
// desvincula, lo hace la FK con ON DELETE SET NULL).
async function removeTaxiExpense(entryId) {
  const existing = await db.Expense.findOne({ where: { kilometrage_entry_id: entryId } });
  if (existing && !(await isLocked(existing))) {
    const legId = existing.legalization_id;
    await existing.destroy();
    await recalculateLegalizationTotals(legId);
  }
}

// IDs de los registros (entre los dados) cuyo taxi ya está incluido en una
// legalización: esos taxis no se suman en el reporte de kilometraje.
async function legalizedTaxiEntryIds(entryIds) {
  if (!entryIds || entryIds.length === 0) return new Set();
  const rows = await db.Expense.findAll({
    where: { kilometrage_entry_id: entryIds, legalization_id: { [db.Sequelize.Op.ne]: null } },
    attributes: ['kilometrage_entry_id', 'legalization_id'],
  });
  return new Set(rows.map(r => r.kilometrage_entry_id));
}

// Recalcula los totales de un reporte de kilometraje. Los taxis que ya están
// en una legalización se excluyen de total_taxis (y por tanto de valor_total).
async function recalculateKmReport(reportId) {
  const entries = await db.KilometrageEntry.findAll({ where: { report_id: reportId } });
  const legalizados = await legalizedTaxiEntryIds(entries.map(e => e.id));
  const totals = entries.reduce((acc, e) => {
    const taxi = legalizados.has(e.id) ? 0 : parseFloat(e.taxis || 0);
    const apoyos = parseFloat(e.peajes || 0) + parseFloat(e.parqueaderos || 0) + taxi + parseFloat(e.otros || 0);
    const quien = pagadoPorDe(e);
    return {
      total_km: acc.total_km + parseFloat(e.total_km || 0),
      total_valor_km: acc.total_valor_km + parseFloat(e.valor_km || 0),
      total_peajes: acc.total_peajes + parseFloat(e.peajes || 0),
      total_parqueaderos: acc.total_parqueaderos + parseFloat(e.parqueaderos || 0),
      total_taxis: acc.total_taxis + taxi,
      total_otros: acc.total_otros + parseFloat(e.otros || 0),
      // Apoyos que NO se pagan por este reporte: los pagó la empresa (tarjeta
      // corporativa / Cabify) o se pagaron con el anticipo (se cruzan en la
      // legalización del viaje). El kilometraje (km × tarifa) siempre se paga.
      total_pagado_empresa: acc.total_pagado_empresa + (quien === 'empresa' ? apoyos : 0),
      total_pagado_anticipo: acc.total_pagado_anticipo + (quien === 'anticipo' ? apoyos : 0),
    };
  }, { total_km: 0, total_valor_km: 0, total_peajes: 0, total_parqueaderos: 0, total_taxis: 0, total_otros: 0, total_pagado_empresa: 0, total_pagado_anticipo: 0 });

  // VALOR A PAGAR al colaborador = km + apoyos que pagó con su dinero
  totals.valor_total = totals.total_valor_km + totals.total_peajes + totals.total_parqueaderos + totals.total_taxis + totals.total_otros
    - totals.total_pagado_empresa - totals.total_pagado_anticipo;
  await db.KilometrageReport.update(totals, { where: { id: reportId } });
}

// Tras cambiar los gastos de una legalización: recalcula los reportes de
// kilometraje de los taxis involucrados (los que entraron y los que salieron).
async function recalculateKmReportsForExpenses(expenseIds) {
  if (!expenseIds || expenseIds.length === 0) return;
  const taxis = await db.Expense.findAll({
    where: { id: expenseIds, kilometrage_entry_id: { [db.Sequelize.Op.ne]: null } },
    attributes: ['kilometrage_entry_id'],
  });
  if (taxis.length === 0) return;
  const entries = await db.KilometrageEntry.findAll({
    where: { id: taxis.map(t => t.kilometrage_entry_id) },
    attributes: ['report_id'],
  });
  const reportIds = [...new Set(entries.map(e => e.report_id))];
  for (const id of reportIds) await recalculateKmReport(id);
}

module.exports = {
  taxiConcepto,
  syncTaxiExpense,
  removeTaxiExpense,
  legalizedTaxiEntryIds,
  recalculateKmReport,
  recalculateKmReportsForExpenses,
};
