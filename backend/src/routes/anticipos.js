const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { notify, notifyRoles } = require('../services/notifications');
const { VISORES, APROBADORES, puedeAprobar } = require('../roles');

// GET /api/anticipos
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.rol === 'comercial') where.user_id = req.user.id;
    const requests = await db.TravelRequest.findAll({
      where,
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona'] }],
      order: [['created_at', 'DESC']],
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener anticipos' });
  }
});

// GET /api/anticipos/pending — for approvers
router.get('/pending', auth, requireRole(...VISORES), async (req, res) => {
  try {
    const where = {};
    // Aprobadores de primer nivel ven los "enviado"; auditoría/dirección ven todo
    if (['gerente_general', 'presidente', 'control_interno', 'contabilidad'].includes(req.user.rol)) {
      where.estado = ['enviado', 'aprobado', 'rechazado', 'anticipo_girado', 'legalizado'];
    } else {
      where.estado = 'enviado';
    }

    const requests = await db.TravelRequest.findAll({
      where,
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona', 'email'] }],
      order: [['created_at', 'DESC']],
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/anticipos
router.post('/', auth, [
  body('motivo').notEmpty(),
  body('ciudad_destino').notEmpty(),
  body('fecha_ida').isDate(),
  body('fecha_regreso').isDate(),
], async (req, res) => {
  try {
    const { destino_tipo, motivo, proceso, ciudad_destino, fecha_ida, fecha_regreso, alojamiento_dia, alimentacion_dia, transportes_dia, imprevistos_dia, representacion_dia, acepta_terminos } = req.body;

    // Validar montos por día: números válidos y no negativos
    const dia = (v) => {
      const n = parseFloat(v || 0);
      return Number.isNaN(n) ? null : n;
    };
    const valores = { alojamiento_dia: dia(alojamiento_dia), alimentacion_dia: dia(alimentacion_dia), transportes_dia: dia(transportes_dia), imprevistos_dia: dia(imprevistos_dia), representacion_dia: dia(representacion_dia) };
    for (const [campo, val] of Object.entries(valores)) {
      if (val === null) return res.status(400).json({ error: `El valor de ${campo.replace('_dia', '')} no es un número válido` });
      if (val < 0) return res.status(400).json({ error: `El valor de ${campo.replace('_dia', '')} no puede ser negativo` });
    }

    const d1 = new Date(fecha_ida), d2 = new Date(fecha_regreso);
    if (d2 < d1) return res.status(400).json({ error: 'La fecha de regreso no puede ser anterior a la de ida' });
    const duracion = Math.max(1, Math.ceil((d2 - d1) / 86400000) + 1);

    // Generar consecutivo del mes/año actual (incluye el año para no repetirse entre años)
    const ahora = new Date();
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();
    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const inicioMes = new Date(anio, mes, 1);
    const inicioMesSiguiente = new Date(anio, mes + 1, 1);
    const count = await db.TravelRequest.count({
      where: { created_at: { [db.Sequelize.Op.gte]: inicioMes, [db.Sequelize.Op.lt]: inicioMesSiguiente } },
    });
    const consecutivo = `${meses[mes]}${anio}-${String(count + 1).padStart(3, '0')}`;

    const presupuesto_total = (valores.alojamiento_dia + valores.alimentacion_dia + valores.transportes_dia + valores.imprevistos_dia + valores.representacion_dia) * duracion;
    const anticipo_total = (valores.alimentacion_dia + valores.transportes_dia) * duracion;

    const request = await db.TravelRequest.create({
      user_id: req.user.id, consecutivo, destino_tipo: destino_tipo || 'NACIONAL',
      motivo, proceso, ciudad_destino, fecha_ida, fecha_regreso,
      duracion_dias: duracion,
      alojamiento_dia: alojamiento_dia || 0,
      alimentacion_dia: alimentacion_dia || 0,
      transportes_dia: transportes_dia || 0,
      imprevistos_dia: imprevistos_dia || 0,
      representacion_dia: representacion_dia || 0,
      presupuesto_total, anticipo_total,
      estado: 'enviado',
      acepta_terminos: acepta_terminos || false,
      fecha_solicitud: new Date().toISOString().split('T')[0],
    });

    const total = parseFloat(anticipo_total).toLocaleString('es-CO');
    notifyRoles(['gerente_ventas', 'gerente_general'], {
      tipo: 'enviado',
      titulo: 'Nueva solicitud de anticipo pendiente',
      mensaje: `${req.user.nombre} solicitó anticipo ${consecutivo} a ${ciudad_destino} por COP $${total}.`,
      ref_tipo: 'anticipo',
      ref_id: request.id,
    }).catch(() => {});

    res.status(201).json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear anticipo' });
  }
});

// POST /api/anticipos/:id/approve
router.post('/:id/approve', auth, requireRole(...APROBADORES), async (req, res) => {
  try {
    const request = await db.TravelRequest.findByPk(req.params.id, {
      include: [{ model: db.User, attributes: ['id', 'rol'] }],
    });
    if (!request) return res.status(404).json({ error: 'No encontrado' });
    if (request.estado !== 'enviado') {
      return res.status(400).json({ error: 'Solo se pueden aprobar o rechazar anticipos en estado "enviado"' });
    }
    // Nadie aprueba sus propias solicitudes, y se respeta la jerarquía
    // (p. ej. la solicitud del gerente general solo la aprueba el presidente).
    if (request.user_id === req.user.id) {
      return res.status(403).json({ error: 'No puedes aprobar tu propia solicitud de anticipo' });
    }
    const rolEmisor = request.User?.rol || 'comercial';
    if (!puedeAprobar(req.user.rol, rolEmisor)) {
      return res.status(403).json({ error: 'No tienes la jerarquía necesaria para aprobar esta solicitud' });
    }

    const { action, comentarios } = req.body;
    if (action === 'rechazar' && !comentarios?.trim()) {
      return res.status(400).json({ error: 'Para rechazar debes incluir un comentario explicando el motivo' });
    }

    const nuevoEstado = action === 'aprobar' ? 'aprobado' : 'rechazado';

    await request.update({
      estado: nuevoEstado,
      aprobado_por: req.user.id,
      fecha_aprobacion: new Date(),
      observaciones: comentarios || null,
    });

    await db.Approval.create({
      tipo: 'anticipo', referencia_id: request.id,
      aprobador_id: req.user.id, rol_aprobador: req.user.rol,
      estado: action === 'aprobar' ? 'aprobado' : 'rechazado', comentarios,
    });

    notify({
      user_id: request.user_id,
      tipo: action === 'aprobar' ? 'aprobado' : 'rechazado',
      titulo: action === 'aprobar' ? 'Anticipo aprobado' : 'No se pudo aprobar el anticipo',
      mensaje: action === 'aprobar'
        ? `Tu solicitud de anticipo ${request.consecutivo} a ${request.ciudad_destino} fue aprobada por ${req.user.nombre}.`
        : `Tu solicitud de anticipo ${request.consecutivo} a ${request.ciudad_destino} no fue autorizada por ${req.user.nombre}.`,
      ref_tipo: 'anticipo',
      ref_id: request.id,
      comentarios,
    }).catch(() => {});

    res.json(request);
  } catch (err) {
    console.error('Approve anticipo error:', err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
