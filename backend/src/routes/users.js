const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/users
router.get('/', auth, requireRole('lider_regional', 'gerente_ventas', 'control_interno', 'administrador'), async (req, res) => {
  try {
    const users = await db.User.findAll({ attributes: { exclude: ['password_hash'] }, order: [['nombre', 'ASC']] });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/users
router.post('/', auth, requireRole('administrador'), async (req, res) => {
  try {
    const { nombre, cedula, email, password, rol, zona, vehiculo_tipo, placa, telefono, lider_regional_id } = req.body;
    const password_hash = await bcrypt.hash(password, 12);
    const user = await db.User.create({ nombre, cedula, email, password_hash, rol, zona, vehiculo_tipo, placa, telefono, lider_regional_id });
    const { password_hash: _, ...userData } = user.toJSON();
    res.status(201).json(userData);
  } catch (err) {
    console.error(err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email o cédula ya registrados' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, requireRole('administrador'), async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password_hash = await bcrypt.hash(updateData.password, 12);
      delete updateData.password;
    }
    await user.update(updateData);
    const { password_hash, ...userData } = user.toJSON();
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
