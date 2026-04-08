const router = require('express').Router();
const { body, param, query } = require('express-validator');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/kilometraje/reports — list user's reports
router.get('/reports', auth, async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    if (req.query.mes) where.periodo_mes = parseInt(req.query.mes);
    if (req.query.anio) where.periodo_anio = parseInt(req.query.anio);

    const reports = await db.KilometrageReport.findAll({
      where,
      include: [{ model: db.KilometrageEntry, as: 'entries', include: [{ model: db.Client, attributes: ['id', 'nombre', 'ciudad'] }] }],
      order: [['periodo_anio', 'DESC'], ['periodo_mes', 'DESC']],
    });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// GET /api/kilometraje/reports/:id
router.get('/reports/:id', auth, async (req, res) => {
  try {
    const report = await db.KilometrageReport.findOne({
      where: { id: req.params.id },
      include: [{ model: db.KilometrageEntry, as: 'entries', include: [{ model: db.Client }] }, { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona', 'vehiculo_tipo', 'placa'] }],
    });
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
});

// POST /api/kilometraje/entries — add a daily entry
router.post('/entries', auth, [
  body('fecha').isDate(),
  body('cliente_nombre').notEmpty(),
  body('medio').isIn(['CARRO', 'MOTO']),
  body('km_inicial').isNumeric(),
  body('km_final').isNumeric(),
], async (req, res) => {
  try {
    const { fecha, cliente_nombre, client_id, medio, km_inicial, km_final, peajes, parqueaderos, taxis, taxi_tipo, taxi_origen, taxi_destino, otros, origen_lat, origen_lng, destino_lat, destino_lng, distancia_api } = req.body;

    const d = new Date(fecha);
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();

    // Find or create the monthly report
    let [report] = await db.KilometrageReport.findOrCreate({
      where: { user_id: req.user.id, periodo_mes: mes, periodo_anio: anio },
      defaults: { user_id: req.user.id, periodo_mes: mes, periodo_anio: anio, estado: 'borrador' },
    });

    if (report.estado === 'aprobado') {
      return res.status(400).json({ error: 'No se puede modificar un reporte aprobado' });
    }

    // Get tariff
    const tarifaCarro = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || process.env.TARIFA_CARRO || '600.65');
    const tarifaMoto = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || process.env.TARIFA_MOTO || '507.03');
    const tarifa = medio === 'CARRO' ? tarifaCarro : tarifaMoto;

    const totalKm = parseFloat(km_final) - parseFloat(km_inicial);
    const valorKm = Math.round(totalKm * tarifa * 100) / 100;

    const entry = await db.KilometrageEntry.create({
      report_id: report.id,
      user_id: req.user.id,
      fecha, cliente_nombre, client_id: client_id || null, medio,
      km_inicial: parseFloat(km_inicial),
      km_final: parseFloat(km_final),
      total_km: totalKm,
      valor_km: valorKm,
      peajes: parseFloat(peajes || 0),
      parqueaderos: parseFloat(parqueaderos || 0),
      taxis: parseFloat(taxis || 0),
      taxi_tipo: taxi_tipo || null,
      taxi_origen: taxi_origen || null,
      taxi_destino: taxi_destino || null,
      otros: parseFloat(otros || 0),
      origen_lat, origen_lng, destino_lat, destino_lng, distancia_api,
    });

    // Recalculate report totals
    await recalculateReport(report.id);

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear registro' });
  }
});

// PUT /api/kilometraje/entries/:id
router.put('/entries/:id', auth, async (req, res) => {
  try {
    const entry = await db.KilometrageEntry.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!entry) return res.status(404).json({ error: 'Registro no encontrado' });

    const report = await db.KilometrageReport.findByPk(entry.report_id);
    if (report.estado === 'aprobado') return res.status(400).json({ error: 'Reporte ya aprobado' });

    const tarifaCarro = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || '600.65');
    const tarifaMoto = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || '507.03');

    if (req.body.km_inicial !== undefined && req.body.km_final !== undefined) {
      const tarifa = (req.body.medio || entry.medio) === 'CARRO' ? tarifaCarro : tarifaMoto;
      req.body.total_km = parseFloat(req.body.km_final) - parseFloat(req.body.km_inicial);
      req.body.valor_km = Math.round(req.body.total_km * tarifa * 100) / 100;
    }

    await entry.update(req.body);
    await recalculateReport(entry.report_id);

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE /api/kilometraje/entries/:id
router.delete('/entries/:id', auth, async (req, res) => {
  try {
    const entry = await db.KilometrageEntry.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!entry) return res.status(404).json({ error: 'No encontrado' });
    const reportId = entry.report_id;
    await entry.destroy();
    await recalculateReport(reportId);
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// POST /api/kilometraje/entries/:id/upload/:field — upload support photo
router.post('/entries/:id/upload/:field', auth, upload.single('foto'), async (req, res) => {
  try {
    const entry = await db.KilometrageEntry.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!entry) return res.status(404).json({ error: 'No encontrado' });

    const field = req.params.field; // peaje_foto, parqueadero_foto, taxi_foto, otros_foto
    const allowed = ['peaje_foto', 'parqueadero_foto', 'taxi_foto', 'otros_foto'];
    if (!allowed.includes(field)) return res.status(400).json({ error: 'Campo no válido' });

    const filePath = `/uploads/${req.file.filename}`;
    await entry.update({ [field]: filePath });

    res.json({ url: filePath });
  } catch (err) {
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

// POST /api/kilometraje/reports/:id/submit — send report for review
router.post('/reports/:id/submit', auth, async (req, res) => {
  try {
    const report = await db.KilometrageReport.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!report) return res.status(404).json({ error: 'No encontrado' });
    if (report.estado !== 'borrador') return res.status(400).json({ error: 'Solo se puede enviar un reporte en borrador' });

    // Validate all entries have required photos
    const entries = await db.KilometrageEntry.findAll({ where: { report_id: report.id } });
    for (const e of entries) {
      if (parseFloat(e.peajes) > 0 && !e.peaje_foto) return res.status(400).json({ error: `Falta foto de peaje para ${e.cliente_nombre} (${e.fecha})` });
      if (parseFloat(e.parqueaderos) > 0 && !e.parqueadero_foto) return res.status(400).json({ error: `Falta foto de parqueadero para ${e.cliente_nombre} (${e.fecha})` });
      if (parseFloat(e.taxis) > 0 && !e.taxi_foto) return res.status(400).json({ error: `Falta foto de taxi para ${e.cliente_nombre} (${e.fecha})` });
    }

    await report.update({ estado: 'enviado', fecha_envio: new Date() });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar' });
  }
});

// POST /api/kilometraje/reports/:id/approve — approve/reject (leader or manager)
router.post('/reports/:id/approve', auth, requireRole('lider_regional', 'gerente_ventas', 'administrador'), async (req, res) => {
  try {
    const report = await db.KilometrageReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'No encontrado' });

    const { action, comentarios } = req.body; // action: 'aprobar' | 'rechazar'
    const nuevoEstado = action === 'aprobar'
      ? (req.user.rol === 'lider_regional' ? 'revisado' : 'aprobado')
      : 'rechazado';

    const updateData = { estado: nuevoEstado };
    if (req.user.rol === 'lider_regional') {
      updateData.revisado_por = req.user.id;
      updateData.fecha_revision = new Date();
    } else {
      updateData.aprobado_por = req.user.id;
      updateData.fecha_aprobacion = new Date();
    }
    if (comentarios) updateData.observaciones = comentarios;

    await report.update(updateData);
    await db.Approval.create({
      tipo: 'kilometraje', referencia_id: report.id,
      aprobador_id: req.user.id, rol_aprobador: req.user.rol,
      estado: action === 'aprobar' ? 'aprobado' : 'rechazado', comentarios,
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// GET /api/kilometraje/pending — for leaders/managers: reports pending approval
router.get('/pending', auth, requireRole('lider_regional', 'gerente_ventas', 'control_interno', 'administrador'), async (req, res) => {
  try {
    const estado = req.user.rol === 'lider_regional' ? 'enviado' : 'revisado';
    const reports = await db.KilometrageReport.findAll({
      where: { estado },
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona'] }],
      order: [['created_at', 'DESC']],
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Helper: recalculate totals
async function recalculateReport(reportId) {
  const entries = await db.KilometrageEntry.findAll({ where: { report_id: reportId } });
  const totals = entries.reduce((acc, e) => ({
    total_km: acc.total_km + parseFloat(e.total_km || 0),
    total_valor_km: acc.total_valor_km + parseFloat(e.valor_km || 0),
    total_peajes: acc.total_peajes + parseFloat(e.peajes || 0),
    total_parqueaderos: acc.total_parqueaderos + parseFloat(e.parqueaderos || 0),
    total_taxis: acc.total_taxis + parseFloat(e.taxis || 0),
    total_otros: acc.total_otros + parseFloat(e.otros || 0),
  }), { total_km: 0, total_valor_km: 0, total_peajes: 0, total_parqueaderos: 0, total_taxis: 0, total_otros: 0 });

  totals.valor_total = totals.total_valor_km + totals.total_peajes + totals.total_parqueaderos + totals.total_taxis + totals.total_otros;

  await db.KilometrageReport.update(totals, { where: { id: reportId } });
}

module.exports = router;
