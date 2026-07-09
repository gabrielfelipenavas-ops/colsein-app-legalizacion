const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { notify, notifyRoles } = require('../services/notifications');
const { ROLES, GERENTES, VISORES, APROBADORES, puedeAprobar, aprobadoresDe } = require('../roles');

// GET /api/legalizations — list user's legalizations
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (!VISORES.includes(req.user.rol)) where.user_id = req.user.id;
    const legalizations = await db.ExpenseLegalization.findAll({
      where,
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'zona'] },
        { model: db.TravelRequest, attributes: ['id', 'consecutivo', 'ciudad_destino', 'fecha_ida', 'fecha_regreso'] },
        { model: db.Expense, as: 'expenses' },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json(legalizations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener legalizaciones' });
  }
});

// GET /api/legalizations/pending — for approvers
router.get('/pending', auth, requireRole(...VISORES), async (req, res) => {
  try {
    const where = {};
    if (req.user.rol === 'lider_regional') where.estado = 'enviado';
    else if (['gerente_ventas', 'gerente_aveva'].includes(req.user.rol)) where.estado = ['enviado', 'revisado'];
    else where.estado = ['enviado', 'revisado', 'aprobado', 'rechazado']; // dirección/auditoría ven todo

    let legalizations = await db.ExpenseLegalization.findAll({
      where,
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'zona', 'email', 'rol'] },
        { model: db.TravelRequest, attributes: ['id', 'consecutivo', 'ciudad_destino', 'fecha_ida', 'fecha_regreso'] },
        { model: db.Expense, as: 'expenses' },
      ],
      order: [['created_at', 'DESC']],
    });

    // Los aprobadores de primer nivel (líder / gerente de ventas / gerente AVEVA)
    // solo ven lo que la jerarquía les permite aprobar: no lo de admin, gerentes
    // ni presidente; la línea AVEVA solo la ve/aprueba su gerente AVEVA.
    if ([ROLES.LIDER, ROLES.GERENTE_VENTAS, ROLES.GERENTE_AVEVA].includes(req.user.rol)) {
      legalizations = legalizations.filter((l) => puedeAprobar(req.user.rol, l.User?.rol));
    }
    res.json(legalizations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/legalizations/:id — get with expenses
router.get('/:id', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id, {
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona'] },
        { model: db.TravelRequest },
        { model: db.Expense, as: 'expenses', order: [['fecha', 'ASC']] },
      ],
    });
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    // Solo el dueño o un aprobador pueden verla (evita ver legalizaciones ajenas por ID)
    if (leg.user_id !== req.user.id && !VISORES.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta legalización' });
    }
    res.json(leg);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/legalizations — create from travel request or standalone
router.post('/', auth, async (req, res) => {
  try {
    const { travel_request_id, ciudades_visitadas, moneda, tipo, motivo } = req.body;
    let valor_anticipo = 0;

    if (travel_request_id) {
      const tr = await db.TravelRequest.findByPk(travel_request_id);
      if (!tr) return res.status(404).json({ error: 'Solicitud de anticipo no encontrada' });
      if (tr.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
      valor_anticipo = parseFloat(tr.anticipo_total || 0);
    }

    const leg = await db.ExpenseLegalization.create({
      user_id: req.user.id,
      travel_request_id: travel_request_id || null,
      ciudades_visitadas: ciudades_visitadas || '',
      moneda: moneda || 'COP',
      valor_anticipo,
      estado: 'borrador',
    });
    // Store extra fields as JSON in observaciones_imprevistos for now
    if (tipo || motivo) {
      await leg.update({ observaciones_imprevistos: JSON.stringify({ tipo: tipo || 'local', motivo: motivo || '' }) });
    }

    res.status(201).json(leg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear legalización' });
  }
});

// PUT /api/legalizations/:id — update main fields
router.put('/:id', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id);
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (leg.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (['enviado', 'revisado', 'aprobado'].includes(leg.estado)) {
      return res.status(409).json({ error: 'No se puede editar una legalización ya enviada. Solicita autorización de modificación para desbloquearla.' });
    }

    const { ciudades_visitadas, moneda, tipo, motivo, valor_anticipo } = req.body;
    const updates = {};
    if (ciudades_visitadas !== undefined) updates.ciudades_visitadas = ciudades_visitadas;
    if (moneda !== undefined) updates.moneda = moneda;
    if (valor_anticipo !== undefined) updates.valor_anticipo = parseFloat(valor_anticipo) || 0;

    if (tipo !== undefined || motivo !== undefined) {
      let current = {};
      try { current = JSON.parse(leg.observaciones_imprevistos || '{}'); } catch {}
      updates.observaciones_imprevistos = JSON.stringify({
        tipo: tipo !== undefined ? tipo : (current.tipo || 'local'),
        motivo: motivo !== undefined ? motivo : (current.motivo || ''),
      });
    }

    await leg.update(updates);

    // Recalculate totals if valor_anticipo changed
    if (valor_anticipo !== undefined) {
      const gasto_real_total = parseFloat(leg.gasto_real_total || 0);
      const anticipo = parseFloat(updates.valor_anticipo);
      const diff = gasto_real_total - anticipo;
      await leg.update({
        pago_favor_empresa: diff < 0 ? Math.abs(diff) : 0,
        pago_favor_empleado: diff > 0 ? diff : 0,
      });
    }

    res.json(leg);
  } catch (err) {
    console.error('Update legalization error:', err);
    res.status(500).json({ error: 'Error al actualizar legalización' });
  }
});

// PUT /api/legalizations/:id/expenses — associate expenses and recalculate
router.put('/:id/expenses', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id);
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (leg.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (['enviado', 'revisado', 'aprobado'].includes(leg.estado)) {
      return res.status(409).json({ error: 'No se pueden modificar los gastos de una legalización ya enviada. Solicita autorización de modificación para desbloquearla.' });
    }

    const { expense_ids } = req.body;
    if (expense_ids !== undefined && !Array.isArray(expense_ids)) {
      return res.status(400).json({ error: 'expense_ids debe ser una lista de IDs de gastos' });
    }
    const ids = (expense_ids || []).map((v) => parseInt(v)).filter((v) => Number.isInteger(v) && v > 0);

    // Un gasto solo puede asociarse si es del usuario y está libre (o ya en esta
    // legalización). Sin este control, se podían "robar" gastos de otra
    // legalización ya enviada, alterando sus totales por fuera del bloqueo.
    if (ids.length > 0) {
      const ocupados = await db.Expense.count({
        where: {
          id: ids,
          user_id: req.user.id,
          legalization_id: { [db.Sequelize.Op.not]: null, [db.Sequelize.Op.ne]: leg.id },
        },
      });
      if (ocupados > 0) {
        return res.status(409).json({ error: 'Uno o más gastos ya pertenecen a otra legalización. Quítalos de la otra legalización primero.' });
      }
    }

    // Reasociación y recálculo en una transacción (evita estados intermedios
    // si algo falla a mitad de camino)
    await db.sequelize.transaction(async (t) => {
      // Remove previous associations
      await db.Expense.update({ legalization_id: null }, { where: { legalization_id: leg.id }, transaction: t });

      // Associate new expenses
      if (ids.length > 0) {
        await db.Expense.update(
          { legalization_id: leg.id },
          { where: { id: ids, user_id: req.user.id, legalization_id: null }, transaction: t }
        );
      }

      // Recalculate totals
      const expenses = await db.Expense.findAll({ where: { legalization_id: leg.id }, transaction: t });
      // Suma el valor legalizable (excluye propina y excedente de servicio); si un gasto
      // antiguo no lo tiene, usa el valor total como respaldo.
      const gasto_real_total = Math.round(expenses.reduce((sum, e) =>
        sum + (e.valor_legalizable != null ? parseFloat(e.valor_legalizable) : parseFloat(e.valor || 0)), 0) * 100) / 100;
      const valor_anticipo = parseFloat(leg.valor_anticipo || 0);
      const diff = Math.round((gasto_real_total - valor_anticipo) * 100) / 100;

      await leg.update({
        gasto_real_total,
        pago_favor_empresa: diff < 0 ? Math.abs(diff) : 0,
        pago_favor_empleado: diff > 0 ? diff : 0,
      }, { transaction: t });
    });

    const updated = await db.ExpenseLegalization.findByPk(leg.id, {
      include: [{ model: db.Expense, as: 'expenses' }],
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar gastos' });
  }
});

// POST /api/legalizations/:id/submit — submit for review
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id, {
      include: [{ model: db.Expense, as: 'expenses' }, { model: db.User, attributes: ['nombre', 'rol'] }],
    });
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (leg.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (!['borrador', 'rechazado'].includes(leg.estado)) {
      return res.status(409).json({ error: 'Esta legalización ya fue enviada. Solicita autorización de modificación para editarla.' });
    }
    if (leg.expenses.length === 0) return res.status(400).json({ error: 'Agrega al menos un gasto' });

    // El presidente no requiere autorización: sus legalizaciones quedan aprobadas al
    // enviarlas. La actualización es condicional al estado actual (evita doble envío).
    if (req.user.rol === ROLES.PRESIDENTE) {
      const [n] = await db.ExpenseLegalization.update(
        { estado: 'aprobado', aprobado_por: req.user.id },
        { where: { id: leg.id, estado: ['borrador', 'rechazado'] } }
      );
      if (n === 0) return res.status(409).json({ error: 'Esta legalización ya fue enviada' });
      if (leg.travel_request_id) {
        await db.TravelRequest.update({ estado: 'legalizado' }, { where: { id: leg.travel_request_id } });
      }
      await leg.reload();
      return res.json(leg);
    }

    const [n] = await db.ExpenseLegalization.update(
      { estado: 'enviado' },
      { where: { id: leg.id, estado: ['borrador', 'rechazado'] } }
    );
    if (n === 0) return res.status(409).json({ error: 'Esta legalización ya fue enviada' });
    await leg.reload();

    // Update travel request status if linked
    if (leg.travel_request_id) {
      await db.TravelRequest.update({ estado: 'legalizado' }, { where: { id: leg.travel_request_id } });
    }

    // Notificar a quien corresponde según la jerarquía (gerentes → presidente, etc.)
    const total = parseFloat(leg.gasto_real_total || 0).toLocaleString('es-CO');
    notifyRoles(aprobadoresDe(leg.User?.rol), {
      tipo: 'enviado',
      titulo: 'Nueva legalización pendiente de aprobación',
      mensaje: `${leg.User?.nombre || 'Un usuario'} envió la Legalización #${leg.id} por COP $${total} con ${leg.expenses.length} gasto(s).`,
      ref_tipo: 'legalizacion',
      ref_id: leg.id,
    }).catch(() => {});

    res.json(leg);
  } catch (err) {
    console.error('Submit legalization error:', err);
    res.status(500).json({ error: 'Error al enviar' });
  }
});

// POST /api/legalizations/:id/approve — approve/reject
router.post('/:id/approve', auth, requireRole(...APROBADORES), async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id, {
      include: [{ model: db.User, attributes: ['rol'] }],
    });
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (!['enviado', 'revisado'].includes(leg.estado)) {
      return res.status(409).json({ error: 'Solo se pueden aprobar o rechazar legalizaciones enviadas o en revisión' });
    }
    // Nadie aprueba sus propias solicitudes
    if (leg.user_id === req.user.id) {
      return res.status(403).json({ error: 'No puedes aprobar tu propia legalización' });
    }
    // Jerarquía: las legalizaciones de admin las aprueba el gerente general o el
    // presidente; las de los gerentes, SOLO el presidente.
    if (!puedeAprobar(req.user.rol, leg.User?.rol)) {
      return res.status(403).json({ error: 'Esta legalización debe ser autorizada por un nivel superior (gerencia / presidencia)' });
    }

    const { action, comentarios } = req.body;
    if (!['aprobar', 'rechazar'].includes(action)) {
      return res.status(400).json({ error: 'Acción no válida: usa "aprobar" o "rechazar"' });
    }
    if (action === 'rechazar' && !comentarios?.trim()) {
      return res.status(400).json({ error: 'Para rechazar debes incluir un comentario explicando el motivo' });
    }

    const nuevoEstado = action === 'aprobar' ? 'aprobado' : 'rechazado';

    // Condicional al estado actual: si dos aprobadores deciden a la vez,
    // solo la primera decisión gana.
    const [n] = await db.ExpenseLegalization.update({
      estado: nuevoEstado,
      [action === 'aprobar' ? 'aprobado_por' : 'revisado_por']: req.user.id,
    }, { where: { id: leg.id, estado: ['enviado', 'revisado'] } });
    if (n === 0) return res.status(409).json({ error: 'Esta legalización ya fue decidida por otro aprobador' });
    await leg.reload();

    await db.Approval.create({
      tipo: 'legalizacion',
      referencia_id: leg.id,
      aprobador_id: req.user.id,
      rol_aprobador: req.user.rol,
      estado: action === 'aprobar' ? 'aprobado' : 'rechazado',
      comentarios,
    });

    // Notify the user who submitted
    notify({
      user_id: leg.user_id,
      tipo: action === 'aprobar' ? 'aprobado' : 'rechazado',
      titulo: action === 'aprobar' ? 'Legalización aprobada' : 'No se pudo legalizar',
      mensaje: action === 'aprobar'
        ? `Tu Legalización #${leg.id} fue aprobada por ${req.user.nombre}.`
        : `Tu Legalización #${leg.id} no fue autorizada por ${req.user.nombre}.`,
      ref_tipo: 'legalizacion',
      ref_id: leg.id,
      comentarios,
    }).catch(() => {});

    res.json(leg);
  } catch (err) {
    console.error('Approve legalization error:', err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
