const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/legalizations — list user's legalizations
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.rol === 'comercial') where.user_id = req.user.id;
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
    res.json(leg);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/legalizations — create from travel request or standalone
router.post('/', auth, async (req, res) => {
  try {
    const { travel_request_id, ciudades_visitadas } = req.body;
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
      valor_anticipo,
      estado: 'borrador',
    });

    res.status(201).json(leg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear legalización' });
  }
});

// PUT /api/legalizations/:id/expenses — associate expenses and recalculate
router.put('/:id/expenses', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id);
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (leg.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const { expense_ids } = req.body;

    // Remove previous associations
    await db.Expense.update({ legalization_id: null }, { where: { legalization_id: leg.id } });

    // Associate new expenses
    if (expense_ids && expense_ids.length > 0) {
      await db.Expense.update(
        { legalization_id: leg.id },
        { where: { id: expense_ids, user_id: req.user.id } }
      );
    }

    // Recalculate totals
    const expenses = await db.Expense.findAll({ where: { legalization_id: leg.id } });
    const gasto_real_total = expenses.reduce((sum, e) => sum + parseFloat(e.valor || 0), 0);
    const valor_anticipo = parseFloat(leg.valor_anticipo || 0);
    const diff = gasto_real_total - valor_anticipo;

    await leg.update({
      gasto_real_total,
      pago_favor_empresa: diff < 0 ? Math.abs(diff) : 0,
      pago_favor_empleado: diff > 0 ? diff : 0,
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
      include: [{ model: db.Expense, as: 'expenses' }],
    });
    if (!leg) return res.status(404).json({ error: 'No encontrada' });
    if (leg.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (leg.expenses.length === 0) return res.status(400).json({ error: 'Agrega al menos un gasto' });

    await leg.update({ estado: 'enviado' });

    // Update travel request status if linked
    if (leg.travel_request_id) {
      await db.TravelRequest.update({ estado: 'legalizado' }, { where: { id: leg.travel_request_id } });
    }

    res.json(leg);
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar' });
  }
});

// POST /api/legalizations/:id/approve — approve/reject
router.post('/:id/approve', auth, requireRole('lider_regional', 'gerente_ventas', 'administrador'), async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id);
    if (!leg) return res.status(404).json({ error: 'No encontrada' });

    const { action, comentarios } = req.body;
    const nuevoEstado = action === 'aprobar' ? 'aprobado' : 'rechazado';

    await leg.update({
      estado: nuevoEstado,
      [action === 'aprobar' ? 'aprobado_por' : 'revisado_por']: req.user.id,
    });

    await db.Approval.create({
      tipo: 'legalizacion',
      referencia_id: leg.id,
      aprobador_id: req.user.id,
      rol_aprobador: req.user.rol,
      estado: action === 'aprobar' ? 'aprobado' : 'rechazado',
      comentarios,
    });

    res.json(leg);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
