const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { ADMIN_SISTEMA } = require('../roles');

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
router.put('/:clave', auth, requireRole(...ADMIN_SISTEMA), async (req, res) => {
  try {
    if (req.body.valor === undefined || req.body.valor === null || String(req.body.valor).trim() === '') {
      return res.status(400).json({ error: 'El valor de la configuración es obligatorio' });
    }
    // Las tarifas de kilometraje deben ser números positivos
    if (/^tarifa_/.test(req.params.clave)) {
      const n = parseFloat(req.body.valor);
      if (Number.isNaN(n) || n <= 0) {
        return res.status(400).json({ error: 'La tarifa debe ser un número mayor a cero' });
      }
    }
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
