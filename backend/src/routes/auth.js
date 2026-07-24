const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../models');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

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

// POST /api/auth/firma — registra/reemplaza la firma manuscrita del colaborador.
// Acepta dos formas:
//   - multipart/form-data con el campo `firma` (imagen subida), o
//   - JSON { dataUrl } con un PNG en base64 (firma dibujada en el canvas).
// La imagen se normaliza con sharp a PNG (ancho máx. 600px) y se guarda en
// UPLOAD_DIR/firmas con nombre no adivinable. La firma se estampa en el PDF
// de la legalización.
router.post('/firma', auth, upload.single('firma'), async (req, res) => {
  try {
    const sharp = require('sharp');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const firmasDir = path.join(uploadDir, 'firmas');
    if (!fs.existsSync(firmasDir)) fs.mkdirSync(firmasDir, { recursive: true });

    let inputBuffer = null;
    if (req.file) {
      // Imagen subida como archivo (el filtro de upload.js ya validó la extensión)
      inputBuffer = fs.readFileSync(req.file.path);
      try { fs.unlinkSync(req.file.path); } catch {}
    } else if (req.body?.dataUrl) {
      // Firma dibujada en el canvas de la app
      const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(req.body.dataUrl);
      if (!match) return res.status(400).json({ error: 'Formato de firma inválido: se espera una imagen PNG/JPEG en base64' });
      inputBuffer = Buffer.from(match[2], 'base64');
      // Límite de 5 MB para el base64 decodificado (una firma no pesa más)
      if (inputBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'La imagen de la firma es demasiado grande (máx. 5 MB)' });
      }
    } else {
      return res.status(400).json({ error: 'Envía la firma como archivo (campo "firma") o como dataUrl en base64' });
    }

    // Normalizar: PNG, ancho máximo 600px (suficiente para estamparla en el PDF)
    const processed = await sharp(inputBuffer)
      .resize({ width: 600, withoutEnlargement: true })
      .png()
      .toBuffer();

    const filename = `firma_${req.user.id}_${uuid()}.png`;
    fs.writeFileSync(path.join(firmasDir, filename), processed);
    const firma_url = `/uploads/firmas/${filename}`;

    // Borrar la firma anterior del disco (si existía) para no acumular archivos
    const user = await db.User.findByPk(req.user.id);
    if (user.firma_url && user.firma_url.startsWith('/uploads/firmas/')) {
      const old = path.resolve(uploadDir, user.firma_url.replace('/uploads/', ''));
      // Solo dentro del directorio de firmas (evita path traversal)
      if (old.startsWith(path.resolve(firmasDir))) { try { fs.unlinkSync(old); } catch {} }
    }

    await user.update({ firma_url });
    res.json({ firma_url });
  } catch (err) {
    console.error('Firma error:', err);
    res.status(500).json({ error: 'Error al guardar la firma' });
  }
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
