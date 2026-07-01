const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { ADMIN_SISTEMA, ROLES } = require('../roles');

const ROLES_VALIDOS = Object.values(ROLES);
// Roles de la cúpula: solo pueden ser asignados/modificados por la propia cúpula
// (gerente general o presidente). Evita que un `administrador` se promueva a sí
// mismo o a otros a superusuario, o que edite/desactive a sus superiores.
const ROLES_CUPULA = [ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];
const esCupula = (rol) => ROLES_CUPULA.includes(rol);

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
    if (rol && !ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    if (esCupula(rol) && !esCupula(req.user.rol)) {
      return res.status(403).json({ error: 'Solo el gerente general o el presidente pueden asignar ese rol' });
    }
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
router.put('/:id', auth, requireRole(...ADMIN_SISTEMA), async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'No encontrado' });

    // Solo la cúpula puede editar cuentas de la cúpula o asignar esos roles.
    if (esCupula(user.rol) && !esCupula(req.user.rol)) {
      return res.status(403).json({ error: 'No puedes modificar la cuenta de un superior jerárquico' });
    }
    if (req.body.rol !== undefined) {
      if (!ROLES_VALIDOS.includes(req.body.rol)) return res.status(400).json({ error: 'Rol no válido' });
      if (esCupula(req.body.rol) && !esCupula(req.user.rol)) {
        return res.status(403).json({ error: 'Solo el gerente general o el presidente pueden asignar ese rol' });
      }
    }

    // Lista blanca de campos editables (evita asignación masiva de campos internos).
    const CAMPOS_EDITABLES = ['nombre', 'cedula', 'email', 'rol', 'zona', 'vehiculo_tipo', 'placa', 'telefono', 'lider_regional_id', 'activo'];
    const updateData = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (req.body[campo] !== undefined) updateData[campo] = req.body[campo];
    }
    if (req.body.password) {
      if (String(req.body.password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      updateData.password_hash = await bcrypt.hash(req.body.password, 12);
    }
    await user.update(updateData);
    const { password_hash, ...userData } = user.toJSON();
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
