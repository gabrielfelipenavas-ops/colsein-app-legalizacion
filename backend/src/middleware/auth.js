const jwt = require('jsonwebtoken');
const db = require('../models');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.User.findByPk(decoded.id, { attributes: { exclude: ['password_hash'] } });
    if (!user || !user.activo) return res.status(401).json({ error: 'Usuario no válido' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

module.exports = { auth, requireRole };
