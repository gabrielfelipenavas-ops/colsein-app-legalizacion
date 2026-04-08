const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/config
router.get('/', auth, async (req, res) => {
  try {
    const configs = await db.SystemConfig.findAll();
    const map = {};
    configs.forEach(c => { map[c.clave] = c.valor; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/config/:clave
router.put('/:clave', auth, requireRole('administrador'), async (req, res) => {
  try {
    const [config] = await db.SystemConfig.findOrCreate({
      where: { clave: req.params.clave },
      defaults: { clave: req.params.clave, valor: req.body.valor, descripcion: req.body.descripcion },
    });
    await config.update({ valor: req.body.valor });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
