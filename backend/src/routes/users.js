const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { ADMIN_SISTEMA, ROLES } = require('../roles');
const { sendCredentialsEmail } = require('../services/notifications');

const ROLES_VALIDOS = Object.values(ROLES);
const VEHICULOS_VALIDOS = ['CARRO', 'MOTO'];

// GET /api/users
router.get('/', auth, requireRole('lider_regional', 'gerente_ventas', 'control_interno', ...ADMIN_SISTEMA), async (req, res) => {
  try {
    const users = await db.User.findAll({ attributes: { exclude: ['password_hash'] }, order: [['nombre', 'ASC']] });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/users
router.post('/', auth, requireRole(...ADMIN_SISTEMA), async (req, res) => {
  try {
    const { nombre, cedula, email, password, rol, zona, vehiculo_tipo, placa, telefono, lider_regional_id } = req.body;
    if (!nombre || !cedula || !email) return res.status(400).json({ error: 'Nombre, cédula y correo son obligatorios' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    if (vehiculo_tipo !== undefined && vehiculo_tipo !== null && vehiculo_tipo !== '' && !VEHICULOS_VALIDOS.includes(vehiculo_tipo)) {
      return res.status(400).json({ error: 'Tipo de vehículo no válido (CARRO o MOTO)' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const user = await db.User.create({ nombre, cedula, email, password_hash, rol, zona, vehiculo_tipo, placa, telefono, lider_regional_id });
    const { password_hash: _, ...userData } = user.toJSON();
    const email_credenciales_enviado = await sendCredentialsEmail({ nombre, email, password, esNuevo: true });
    res.status(201).json({ ...userData, email_credenciales_enviado });
  } catch (err) {
    console.error(err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email o cédula ya registrados' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, requireRole(...ADMIN_SISTEMA), async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'No encontrado' });

    // Lista blanca de campos editables (evita asignación masiva de campos
    // internos como password_hash, id o created_at directamente desde el body)
    const editables = ['nombre', 'cedula', 'email', 'rol', 'zona', 'vehiculo_tipo', 'placa', 'telefono', 'lider_regional_id', 'activo'];
    const updateData = {};
    for (const k of editables) {
      if (req.body[k] !== undefined) updateData[k] = req.body[k];
    }
    if (updateData.rol !== undefined && !ROLES_VALIDOS.includes(updateData.rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    if (updateData.vehiculo_tipo !== undefined && updateData.vehiculo_tipo !== null && updateData.vehiculo_tipo !== '' && !VEHICULOS_VALIDOS.includes(updateData.vehiculo_tipo)) {
      return res.status(400).json({ error: 'Tipo de vehículo no válido (CARRO o MOTO)' });
    }

    const nuevaPassword = req.body.password;
    if (nuevaPassword) {
      if (String(nuevaPassword).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      updateData.password_hash = await bcrypt.hash(nuevaPassword, 12);
    }
    await user.update(updateData);
    const { password_hash, ...userData } = user.toJSON();
    // Si el administrador restableció la contraseña, avisar al usuario por correo
    let email_credenciales_enviado;
    if (nuevaPassword) {
      email_credenciales_enviado = await sendCredentialsEmail({ nombre: user.nombre, email: user.email, password: nuevaPassword, esNuevo: false });
    }
    res.json(email_credenciales_enviado === undefined ? userData : { ...userData, email_credenciales_enviado });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
