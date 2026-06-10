const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');

// GET /api/establishments?search= — autocompletar lugares ya usados
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.query.search && req.query.search.trim().length >= 1) {
      where.nombre_norm = { [db.Sequelize.Op.iLike]: `%${req.query.search.trim().toLowerCase()}%` };
    }
    const list = await db.Establishment.findAll({
      where,
      order: [['veces', 'DESC'], ['nombre', 'ASC']],
      limit: parseInt(req.query.limit || '8'),
    });
    res.json(list);
  } catch (err) {
    console.error('List establishments error:', err);
    res.status(500).json({ error: 'Error al obtener establecimientos' });
  }
});

module.exports = router;
