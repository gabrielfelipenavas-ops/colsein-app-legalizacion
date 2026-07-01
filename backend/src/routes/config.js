const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { ADMIN_SISTEMA } = require('../roles');

// Claves visibles para cualquier usuario autenticado. El resto de la configuración
// solo la ven los administradores del sistema (si mañana se guarda una clave
// sensible, no se filtra a todos los empleados).
const CLAVES_PUBLICAS = ['tarifa_carro', 'tarifa_moto'];

// GET /api/config
router.get('/', auth, async (req, res) => {
  try {
    const esAdmin = req.user.rol === 'presidente' || ADMIN_SISTEMA.includes(req.user.rol);
    const configs = await db.SystemConfig.findAll(
      esAdmin ? {} : { where: { clave: CLAVES_PUBLICAS } }
    );
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
