const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { notify, notifyRoles } = require('../services/notifications');
const { ROLES, GERENTES, AUTORIZADORES_ESPECIALES } = require('../roles');

const TIPOS = ['taxi', 'gasto_especial', 'modificacion'];

// Al autorizar una solicitud de modificación, la legalización vuelve a
// borrador para que el usuario pueda editarla y reenviarla.
async function desbloquearLegalizacion(solicitud) {
  if (solicitud.tipo !== 'modificacion' || solicitud.ref_tipo !== 'legalizacion' || !solicitud.ref_id) return;
  const leg = await db.ExpenseLegalization.findByPk(solicitud.ref_id);
  if (!leg) return;
  await leg.update({ estado: 'borrador', revisado_por: null, aprobado_por: null });
}

// GET /api/authorizations — mías (o pendientes si soy autorizador)
router.get('/', auth, async (req, res) => {
  try {
    const where = AUTORIZADORES_ESPECIALES.includes(req.user.rol) ? {} : { user_id: req.user.id };
    const list = await db.AuthRequest.findAll({
      where,
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona', 'rol'] }],
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
    let list = await db.AuthRequest.findAll({
      where: { estado: 'pendiente' },
      include: [{ model: db.User, attributes: ['id', 'nombre', 'zona', 'rol'] }],
      order: [['created_at', 'ASC']],
    });
    // Las solicitudes de un gerente SOLO las autoriza el presidente; nadie ve
    // las suyas propias como pendientes por autorizar.
    if (req.user.rol !== ROLES.PRESIDENTE) {
      list = list.filter((s) => !GERENTES.includes(s.User?.rol) && s.user_id !== req.user.id);
    }
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

    const tipoFinal = TIPOS.includes(tipo) ? tipo : 'taxi';

    // Solicitud de modificación: validar que la legalización exista, sea del
    // usuario y esté enviada/revisada/aprobada (bloqueada para edición).
    if (tipoFinal === 'modificacion') {
      if (ref_tipo !== 'legalizacion' || !ref_id) {
        return res.status(400).json({ error: 'La solicitud de modificación debe referenciar una legalización' });
      }
      const leg = await db.ExpenseLegalization.findByPk(ref_id);
      if (!leg || leg.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Legalización no encontrada' });
      }
      if (leg.estado === 'borrador') {
        return res.status(400).json({ error: 'La legalización está en borrador: puedes modificarla directamente' });
      }
      const yaPendiente = await db.AuthRequest.findOne({
        where: { tipo: 'modificacion', ref_tipo: 'legalizacion', ref_id, estado: 'pendiente' },
      });
      if (yaPendiente) {
        return res.status(400).json({ error: 'Ya hay una solicitud de modificación pendiente para esta legalización' });
      }
    }

    // El presidente no requiere autorización: sus solicitudes quedan autorizadas de inmediato
    const esPresidente = req.user.rol === ROLES.PRESIDENTE;

    const solicitud = await db.AuthRequest.create({
      user_id: req.user.id,
      tipo: tipoFinal,
      concepto: String(concepto).slice(0, 300),
      monto: parseFloat(monto) >= 0 ? parseFloat(monto) : 0,
      detalle: detalle || null,
      ref_tipo: ref_tipo || null,
      ref_id: ref_id || null,
      estado: esPresidente ? 'autorizado' : 'pendiente',
      autorizado_por: esPresidente ? req.user.id : null,
    });

    if (esPresidente) {
      await desbloquearLegalizacion(solicitud);
      return res.status(201).json(solicitud);
    }

    // Las solicitudes de un gerente SOLO las autoriza el presidente
    const destinatarios = GERENTES.includes(req.user.rol) ? [ROLES.PRESIDENTE] : AUTORIZADORES_ESPECIALES;
    const montoFmt = parseFloat(solicitud.monto || 0).toLocaleString('es-CO');
    notifyRoles(destinatarios, {
      tipo: 'info',
      titulo: tipoFinal === 'modificacion' ? 'Solicitud de modificación de legalización' : 'Nueva solicitud de autorización',
      mensaje: `${req.user.nombre} solicita ${tipoFinal === 'modificacion' ? 'permiso para modificar una legalización ya enviada' : 'autorización'}: ${solicitud.concepto}${montoFmt !== '0' ? ` (COP $${montoFmt})` : ''}.`,
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
    const solicitud = await db.AuthRequest.findByPk(req.params.id, {
      include: [{ model: db.User, attributes: ['id', 'rol'] }],
    });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
    }

    // Nadie autoriza sus propias solicitudes
    if (solicitud.user_id === req.user.id) {
      return res.status(403).json({ error: 'No puedes autorizar tus propias solicitudes' });
    }
    // Las solicitudes de un gerente SOLO las autoriza el presidente
    if (GERENTES.includes(solicitud.User?.rol) && req.user.rol !== ROLES.PRESIDENTE) {
      return res.status(403).json({ error: 'Las solicitudes de un gerente solo las autoriza el presidente' });
    }

    const { action, comentarios } = req.body;
    if (action === 'rechazar' && !comentarios?.trim()) {
      return res.status(400).json({ error: 'Para rechazar incluye un comentario con el motivo' });
    }
    const nuevoEstado = action === 'autorizar' ? 'autorizado' : 'rechazado';
    await solicitud.update({ estado: nuevoEstado, autorizado_por: req.user.id, comentarios: comentarios || null });

    // Si se autorizó una modificación, desbloquear la legalización (vuelve a borrador)
    if (nuevoEstado === 'autorizado') await desbloquearLegalizacion(solicitud);

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
