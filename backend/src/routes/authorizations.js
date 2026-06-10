const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { notify, notifyRoles } = require('../services/notifications');
const { AUTORIZADORES_ESPECIALES } = require('../roles');

// GET /api/authorizations — mías (o pendientes si soy autorizador)
router.get('/', auth, async (req, res) => {
  try {
    const where = AUTORIZADORES_ESPECIALES.includes(req.user.rol) ? {} : { user_id: req.user.id };
    const list = await db.AuthRequest.findAll({
      where,
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona'] }],
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    res.json(list);
  } catch (err) {
    console.error('List authorizations error:', err);
    res.status(500).json({ error: 'Error al obtener autorizaciones' });
  }
});

// GET /api/authorizations/pending — para autorizadores (Gerente Comercial / General / Presidente)
router.get('/pending', auth, requireRole(...AUTORIZADORES_ESPECIALES), async (req, res) => {
  try {
    const list = await db.AuthRequest.findAll({
      where: { estado: 'pendiente' },
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona'] }],
      order: [['created_at', 'ASC']],
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/authorizations — solicitar autorización (el gasto se puede cargar igual)
router.post('/', auth, async (req, res) => {
  try {
    const { tipo, concepto, monto, detalle, ref_tipo, ref_id } = req.body;
    if (!concepto || !String(concepto).trim()) {
      return res.status(400).json({ error: 'Describe qué necesitas autorizar (concepto)' });
    }
    const solicitud = await db.AuthRequest.create({
      user_id: req.user.id,
      tipo: tipo === 'gasto_especial' ? 'gasto_especial' : 'taxi',
      concepto: String(concepto).slice(0, 300),
      monto: parseFloat(monto) >= 0 ? parseFloat(monto) : 0,
      detalle: detalle || null,
      ref_tipo: ref_tipo || null,
      ref_id: ref_id || null,
      estado: 'pendiente',
    });

    const montoFmt = parseFloat(solicitud.monto || 0).toLocaleString('es-CO');
    notifyRoles(AUTORIZADORES_ESPECIALES, {
      tipo: 'info',
      titulo: 'Nueva solicitud de autorización',
      mensaje: `${req.user.nombre} solicita autorización: ${solicitud.concepto}${montoFmt !== '0' ? ` (COP $${montoFmt})` : ''}.`,
      ref_tipo: null,
      ref_id: solicitud.id,
    }).catch(() => {});

    res.status(201).json(solicitud);
  } catch (err) {
    console.error('Create authorization error:', err);
    res.status(500).json({ error: 'No se pudo crear la solicitud de autorización' });
  }
});

// POST /api/authorizations/:id/decide — autorizar / rechazar
router.post('/:id/decide', auth, requireRole(...AUTORIZADORES_ESPECIALES), async (req, res) => {
  try {
    const solicitud = await db.AuthRequest.findByPk(req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
    }
    const { action, comentarios } = req.body;
    if (action === 'rechazar' && !comentarios?.trim()) {
      return res.status(400).json({ error: 'Para rechazar incluye un comentario con el motivo' });
    }
    const nuevoEstado = action === 'autorizar' ? 'autorizado' : 'rechazado';
    await solicitud.update({ estado: nuevoEstado, autorizado_por: req.user.id, comentarios: comentarios || null });

    notify({
      user_id: solicitud.user_id,
      tipo: nuevoEstado === 'autorizado' ? 'aprobado' : 'rechazado',
      titulo: nuevoEstado === 'autorizado' ? 'Autorización concedida' : 'Autorización rechazada',
      mensaje: `Tu solicitud "${solicitud.concepto}" fue ${nuevoEstado === 'autorizado' ? 'autorizada' : 'rechazada'} por ${req.user.nombre}.`,
      ref_tipo: null,
      ref_id: solicitud.id,
      comentarios,
    }).catch(() => {});

    res.json(solicitud);
  } catch (err) {
    console.error('Decide authorization error:', err);
    res.status(500).json({ error: 'No se pudo procesar la autorización' });
  }
});

module.exports = router;
