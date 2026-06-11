const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { generateFlat } = require('../services/netsuiteFlat');

// Roles que acceden al módulo de contabilidad
const CONTABLES = ['contabilidad', 'administrador', 'gerente_general', 'presidente'];

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Legalizaciones (aprobadas) con gastos en el mes, con sus gastos filtrados al mes
async function legalizacionesDelMes(year, month, soloAprobadas = true) {
  const where = {};
  if (soloAprobadas) where.estado = 'aprobado';
  const legs = await db.ExpenseLegalization.findAll({
    where,
    include: [
      { model: db.User, attributes: ['id', 'nombre', 'zona'] },
      { model: db.Expense, as: 'expenses' },
    ],
    order: [['id', 'ASC']],
  });
  // Filtrar gastos al mes pedido
  return legs
    .map((l) => {
      const expensesMes = (l.expenses || []).filter((e) => {
        const d = new Date(e.fecha);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      return { leg: l, expensesMes };
    })
    .filter((x) => x.expensesMes.length > 0);
}

// GET /api/accounting/mappings — mapeo contable editable
router.get('/mappings', auth, requireRole(...CONTABLES), async (req, res) => {
  try {
    const list = await db.AccountingMapping.findAll({ order: [['categoria', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el mapeo contable' });
  }
});

// PUT /api/accounting/mappings/:id — actualizar una fila del mapeo
router.put('/mappings/:id', auth, requireRole(...CONTABLES), async (req, res) => {
  try {
    const map = await db.AccountingMapping.findByPk(req.params.id);
    if (!map) return res.status(404).json({ error: 'No encontrado' });
    const campos = ['concepto_tributario', 'cuenta', 'cuenta_id', 'codigo_iva', 'descripcion'];
    const updates = {};
    for (const c of campos) if (req.body[c] !== undefined) updates[c] = req.body[c];
    await map.update(updates);
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el mapeo' });
  }
});

// GET /api/accounting/legalizations/:year/:month — auditoría: líneas del mes
router.get('/legalizations/:year/:month', auth, requireRole(...CONTABLES), async (req, res) => {
  try {
    const year = parseInt(req.params.year), month = parseInt(req.params.month);
    const soloAprobadas = req.query.todas !== 'true';
    const data = await legalizacionesDelMes(year, month, soloAprobadas);
    const resumen = data.map(({ leg, expensesMes }) => ({
      id: leg.id,
      usuario: leg.User?.nombre,
      zona: leg.User?.zona,
      estado: leg.estado,
      gastos: expensesMes.map((e) => ({
        id: e.id, fecha: e.fecha, categoria: e.categoria, establecimiento: e.establecimiento,
        numero_factura: e.numero_factura, valor: e.valor, iva: e.iva, impoconsumo: e.impoconsumo,
        servicio: e.servicio, propina: e.propina, valor_legalizable: e.valor_legalizable,
      })),
    }));
    const totalLineas = resumen.reduce((s, l) => s + l.gastos.length, 0);
    res.json({ year, month, legalizaciones: resumen, total_legalizaciones: resumen.length, total_lineas: totalLineas });
  } catch (err) {
    console.error('Audit month error:', err);
    res.status(500).json({ error: 'Error al obtener la auditoría del mes' });
  }
});

// GET /api/accounting/netsuite/:year/:month — descargar el archivo plano
router.get('/netsuite/:year/:month', auth, requireRole(...CONTABLES), async (req, res) => {
  try {
    const year = parseInt(req.params.year), month = parseInt(req.params.month);
    const data = await legalizacionesDelMes(year, month);

    const mappings = await db.AccountingMapping.findAll();
    const mappingByCat = {};
    mappings.forEach((m) => { mappingByCat[m.categoria] = m; });

    const batchLabel = `PG CMT ${(meses[month - 1] || '').toUpperCase()} ${year}`;
    const legsParaPlano = data.map(({ leg, expensesMes }) => ({ id: leg.id, expenses: expensesMes }));
    const csv = generateFlat(legsParaPlano, mappingByCat, { batchLabel });

    const filename = `ARCHIVO_PLANO_${(meses[month - 1] || 'MES').toUpperCase()}_${year}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM para que Excel/NetSuite lean bien los acentos
  } catch (err) {
    console.error('Netsuite flat error:', err);
    res.status(500).json({ error: 'Error al generar el archivo plano' });
  }
});

module.exports = router;
