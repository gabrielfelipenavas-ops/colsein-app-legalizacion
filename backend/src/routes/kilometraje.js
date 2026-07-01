const router = require('express').Router();
const { body, param, query } = require('express-validator');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { notify, notifyRoles } = require('../services/notifications');
const { VISORES, APROBADORES, puedeAprobar } = require('../roles');

// Un reporte solo se puede modificar mientras está en manos del empleado:
// en borrador o devuelto (rechazado). Una vez enviado a revisión ya no se
// pueden agregar/editar/borrar registros (evita inflar totales tras el envío).
const ESTADOS_MODIFICABLES = ['borrador', 'rechazado'];
const ERROR_NO_MODIFICABLE = 'No se puede modificar un reporte que ya fue enviado o aprobado';

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
    // Solo el dueño o un aprobador pueden ver el reporte (evita ver datos ajenos por ID)
    if (report.user_id !== req.user.id && !VISORES.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este reporte' });
    }
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

    if (!ESTADOS_MODIFICABLES.includes(report.estado)) {
      return res.status(400).json({ error: ERROR_NO_MODIFICABLE });
    }

    // Get tariff
    const tarifaCarro = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || process.env.TARIFA_CARRO || '600.65');
    const tarifaMoto = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || process.env.TARIFA_MOTO || '507.03');
    const tarifa = medio === 'CARRO' ? tarifaCarro : tarifaMoto;

    const kmIni = parseFloat(km_inicial);
    const kmFin = parseFloat(km_final);
    if (Number.isNaN(kmIni) || Number.isNaN(kmFin) || kmIni < 0 || kmFin < 0) {
      return res.status(400).json({ error: 'Los kilómetros deben ser números válidos y no negativos' });
    }
    if (kmFin < kmIni) {
      return res.status(400).json({ error: 'El kilometraje final no puede ser menor que el inicial' });
    }
    // Montos de apoyo no pueden ser negativos
    for (const [campo, etiqueta] of [['peajes', 'peajes'], ['parqueaderos', 'parqueaderos'], ['taxis', 'taxis'], ['otros', 'otros']]) {
      if (req.body[campo] !== undefined && parseFloat(req.body[campo]) < 0) {
        return res.status(400).json({ error: `El valor de ${etiqueta} no puede ser negativo` });
      }
    }

    const totalKm = kmFin - kmIni;
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
    if (!ESTADOS_MODIFICABLES.includes(report.estado)) return res.status(400).json({ error: ERROR_NO_MODIFICABLE });

    const tarifaCarro = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || '600.65');
    const tarifaMoto = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || '507.03');

    // Lista blanca de campos editables (evita que el usuario fije valor_km, total_km,
    // user_id, report_id, etc. directamente y se salte el cálculo por tarifa).
    const editables = ['fecha', 'cliente_nombre', 'client_id', 'medio', 'km_inicial', 'km_final',
      'peajes', 'parqueaderos', 'taxis', 'taxi_tipo', 'taxi_origen', 'taxi_destino', 'otros'];
    const updates = {};
    for (const k of editables) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    // Validar montos no negativos
    for (const campo of ['peajes', 'parqueaderos', 'taxis', 'otros']) {
      if (updates[campo] !== undefined && parseFloat(updates[campo]) < 0) {
        return res.status(400).json({ error: `El valor de ${campo} no puede ser negativo` });
      }
    }

    // Recalcular total_km y valor_km en el servidor a partir de los km
    const kmIni = updates.km_inicial !== undefined ? parseFloat(updates.km_inicial) : parseFloat(entry.km_inicial);
    const kmFin = updates.km_final !== undefined ? parseFloat(updates.km_final) : parseFloat(entry.km_final);
    if (Number.isNaN(kmIni) || Number.isNaN(kmFin) || kmIni < 0 || kmFin < 0) {
      return res.status(400).json({ error: 'Los kilómetros deben ser números válidos y no negativos' });
    }
    if (kmFin < kmIni) {
      return res.status(400).json({ error: 'El kilometraje final no puede ser menor que el inicial' });
    }
    const medioFinal = updates.medio || entry.medio;
    const tarifa = medioFinal === 'CARRO' ? tarifaCarro : tarifaMoto;
    updates.total_km = kmFin - kmIni;
    updates.valor_km = Math.round(updates.total_km * tarifa * 100) / 100;

    await entry.update(updates);
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
    const reportDel = await db.KilometrageReport.findByPk(entry.report_id);
    if (reportDel && !ESTADOS_MODIFICABLES.includes(reportDel.estado)) {
      return res.status(400).json({ error: ERROR_NO_MODIFICABLE });
    }
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
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

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
    if (!ESTADOS_MODIFICABLES.includes(report.estado)) return res.status(400).json({ error: 'Solo se puede enviar un reporte en borrador o devuelto para corrección' });

    // Validate all entries have required photos
    const entries = await db.KilometrageEntry.findAll({ where: { report_id: report.id } });
    for (const e of entries) {
      if (parseFloat(e.peajes) > 0 && !e.peaje_foto) return res.status(400).json({ error: `Falta foto de peaje para ${e.cliente_nombre} (${e.fecha})` });
      if (parseFloat(e.parqueaderos) > 0 && !e.parqueadero_foto) return res.status(400).json({ error: `Falta foto de parqueadero para ${e.cliente_nombre} (${e.fecha})` });
      if (parseFloat(e.taxis) > 0 && !e.taxi_foto) return res.status(400).json({ error: `Falta foto de taxi para ${e.cliente_nombre} (${e.fecha})` });
    }

    await report.update({ estado: 'enviado', fecha_envio: new Date() });

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const periodo = `${meses[report.periodo_mes - 1]} ${report.periodo_anio}`;
    const total = parseFloat(report.valor_total || 0).toLocaleString('es-CO');
    notifyRoles(['lider_regional', 'gerente_ventas', 'gerente_general'], {
      tipo: 'enviado',
      titulo: 'Nuevo reporte de kilometraje pendiente',
      mensaje: `${req.user.nombre} envió el Reporte de Kilometraje de ${periodo} por COP $${total}.`,
      ref_tipo: 'kilometraje',
      ref_id: report.id,
    }).catch(() => {});

    res.json(report);
  } catch (err) {
    console.error('Submit km error:', err);
    res.status(500).json({ error: 'Error al enviar' });
  }
});

// POST /api/kilometraje/reports/:id/approve — approve/reject (leader or manager)
router.post('/reports/:id/approve', auth, requireRole(...APROBADORES), async (req, res) => {
  try {
    const report = await db.KilometrageReport.findByPk(req.params.id, {
      include: [{ model: db.User, attributes: ['id', 'rol'] }],
    });
    if (!report) return res.status(404).json({ error: 'No encontrado' });
    if (!['enviado', 'revisado'].includes(report.estado)) {
      return res.status(400).json({ error: 'Solo se pueden aprobar o rechazar reportes enviados o revisados' });
    }
    // Nadie aprueba su propio reporte, y se respeta la jerarquía de aprobación.
    if (report.user_id === req.user.id) {
      return res.status(403).json({ error: 'No puedes aprobar tu propio reporte de kilometraje' });
    }
    const rolEmisorKm = report.User?.rol || 'comercial';
    if (!puedeAprobar(req.user.rol, rolEmisorKm)) {
      return res.status(403).json({ error: 'No tienes la jerarquía necesaria para aprobar este reporte' });
    }

    const { action, comentarios } = req.body; // action: 'aprobar' | 'rechazar'
    if (action === 'rechazar' && !comentarios?.trim()) {
      return res.status(400).json({ error: 'Para rechazar debes incluir un comentario explicando el motivo' });
    }

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

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const periodo = `${meses[report.periodo_mes - 1]} ${report.periodo_anio}`;

    if (req.user.rol === 'lider_regional' && action === 'aprobar') {
      // Forward to gerente_ventas / admin for final approval
      notifyRoles(['gerente_ventas', 'gerente_general'], {
        tipo: 'enviado',
        titulo: 'Kilometraje revisado, pendiente de aprobación final',
        mensaje: `${req.user.nombre} revisó el Reporte de Kilometraje de ${periodo}. Pendiente de aprobación final.`,
        ref_tipo: 'kilometraje',
        ref_id: report.id,
      }).catch(() => {});
    } else {
      // Notify the original user
      notify({
        user_id: report.user_id,
        tipo: action === 'aprobar' ? 'aprobado' : 'rechazado',
        titulo: action === 'aprobar' ? 'Kilometraje aprobado' : 'No se pudo aprobar el kilometraje',
        mensaje: action === 'aprobar'
          ? `Tu Reporte de Kilometraje de ${periodo} fue aprobado por ${req.user.nombre}.`
          : `Tu Reporte de Kilometraje de ${periodo} no fue autorizado por ${req.user.nombre}.`,
        ref_tipo: 'kilometraje',
        ref_id: report.id,
        comentarios,
      }).catch(() => {});
    }

    res.json(report);
  } catch (err) {
    console.error('Approve km error:', err);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// GET /api/kilometraje/pending — for leaders/managers: reports pending approval
router.get('/pending', auth, requireRole(...VISORES), async (req, res) => {
  try {
    let estado;
    if (req.user.rol === 'lider_regional') estado = 'enviado';
    else if (req.user.rol === 'gerente_ventas') estado = ['enviado', 'revisado'];
    else estado = ['enviado', 'revisado', 'aprobado', 'rechazado']; // gerente_general, presidente, control_interno, contabilidad: ven todo

    const reports = await db.KilometrageReport.findAll({
      where: { estado },
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'zona', 'email', 'cedula', 'vehiculo_tipo', 'placa'] },
        { model: db.KilometrageEntry, as: 'entries', include: [{ model: db.Client }] },
      ],
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
