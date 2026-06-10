const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');

// GET /api/notifications — list user's notifications (latest 50)
router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const where = { user_id: req.user.id };
    if (req.query.solo_no_leidas === 'true') where.leida = false;

    const notifications = await db.Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
    });
    res.json(notifications);
  } catch (err) {
    console.error('Error listando notificaciones:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await db.Notification.count({
      where: { user_id: req.user.id, leida: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/notifications/:id/read — mark single as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notif = await db.Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!notif) return res.status(404).json({ error: 'No encontrada' });
    await notif.update({ leida: true });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await db.Notification.update(
      { leida: true },
      { where: { user_id: req.user.id, leida: false } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
