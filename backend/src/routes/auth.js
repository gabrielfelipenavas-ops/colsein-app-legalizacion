const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../models');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 4 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await db.User.findOne({ where: { email, activo: true } });
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    // Cookie httpOnly con el mismo token, usada SOLO para autorizar la descarga de
    // archivos de /uploads (los <img> del navegador no envían el header Authorization).
    res.cookie('colsein_auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/uploads',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password_hash, ...userData } = user.toJSON();
    res.json({ token, user: userData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — limpia la cookie de acceso a archivos
router.post('/logout', (req, res) => {
  res.clearCookie('colsein_auth', { path: '/uploads' });
  res.json({ message: 'Sesión cerrada' });
});

// PUT /api/auth/password
router.put('/password', auth, [
  body('current_password').isLength({ min: 1 }),
  body('new_password').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await db.User.findByPk(req.user.id);
    const valid = await bcrypt.compare(req.body.current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    user.password_hash = await bcrypt.hash(req.body.new_password, 12);
    await user.save();
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
