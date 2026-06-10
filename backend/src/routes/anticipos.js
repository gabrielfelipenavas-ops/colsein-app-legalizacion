const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { notify, notifyRoles } = require('../services/notifications');

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
router.get('/pending', auth, requireRole('lider_regional', 'gerente_ventas', 'control_interno', 'administrador'), async (req, res) => {
  try {
    const where = {};
    if (req.user.rol === 'administrador') where.estado = ['enviado', 'aprobado', 'rechazado', 'anticipo_girado', 'legalizado'];
    else where.estado = 'enviado';

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

    const d1 = new Date(fecha_ida), d2 = new Date(fecha_regreso);
    const duracion = Math.max(1, Math.ceil((d2 - d1) / 86400000) + 1);

    // Generate consecutivo
    const mes = new Date().getMonth();
    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const count = await db.TravelRequest.count({ where: db.sequelize.where(db.sequelize.fn('EXTRACT', db.sequelize.literal("MONTH FROM created_at")), mes + 1) });
    const consecutivo = `${meses[mes]}-${String(count + 1).padStart(3, '0')}`;

    const presupuesto_total = (parseFloat(alojamiento_dia||0) + parseFloat(alimentacion_dia||0) + parseFloat(transportes_dia||0) + parseFloat(imprevistos_dia||0) + parseFloat(representacion_dia||0)) * duracion;
    const anticipo_total = (parseFloat(alimentacion_dia||0) + parseFloat(transportes_dia||0)) * duracion;

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
    notifyRoles(['gerente_ventas', 'administrador'], {
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
router.post('/:id/approve', auth, requireRole('lider_regional', 'gerente_ventas', 'administrador'), async (req, res) => {
  try {
    const request = await db.TravelRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'No encontrado' });

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
