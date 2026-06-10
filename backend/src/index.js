require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── SEGURIDAD: validar el secreto de firma de tokens al arrancar ──
const DEFAULT_JWT_SECRET = 'colsein-jwt-secret-change-in-production-2026';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
  const msg = '⛔ JWT_SECRET no está configurado o usa el valor por defecto inseguro. Configura una clave larga y aleatoria.';
  if (isProd) {
    console.error(msg + ' El servidor NO arrancará en producción sin un JWT_SECRET seguro.');
    process.exit(1);
  } else {
    console.warn('⚠️  ' + msg + ' (permitido solo en desarrollo).');
  }
}

// ── MIDDLEWARE ──
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS: en producción solo se permite el origen configurado (FRONTEND_URL). Si no se
// configura, no se habilita CORS cruzado (la app se sirve desde el mismo origen).
app.use(cors({ origin: process.env.FRONTEND_URL || (isProd ? false : 'http://localhost:5173'), credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Detrás del proxy de Railway: confiar en 1 salto para identificar la IP real (rate limiting)
app.set('trust proxy', 1);

// ── LÍMITE DE PETICIONES (anti fuerza bruta y abuso) ──
// Límite estricto en el login: 10 intentos cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
});
app.use('/api/auth/login', loginLimiter);
// Límite general (holgado) para el resto de la API
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento e intenta de nuevo.' },
}));

// Static uploads — se sirven con cabeceras que impiden que el navegador interprete
// (ejecute) el archivo. Junto con el filtro de tipos, evita el XSS por archivos subidos.
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(path.resolve(uploadDir), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  },
}));

// ── ROUTES ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/kilometraje', require('./routes/kilometraje'));
app.use('/api/anticipos', require('./routes/anticipos'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/legalizations', require('./routes/legalizations'));
app.use('/api/email', require('./routes/email'));
app.use('/api/config', require('./routes/config'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  // Errores de subida de archivos (multer) → mensaje claro para el usuario
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. El tamaño máximo permitido es 10 MB.' });
    }
    return res.status(400).json({ error: 'No se pudo subir el archivo. Verifica el formato e intenta de nuevo.' });
  }
  // Error del filtro de tipo de archivo (lanzado en upload.js)
  if (err && /Tipo de archivo no permitido/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── START ──
async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Base de datos conectada');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API corriendo en http://0.0.0.0:${PORT}`);
      console.log(`📋 Endpoints: http://0.0.0.0:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('❌ Error al conectar BD:', err.message);
    console.log('💡 Asegúrate de que PostgreSQL esté corriendo (docker-compose up -d)');
    // Start anyway for development without DB
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚠️  API corriendo SIN base de datos en http://0.0.0.0:${PORT}`);
    });
  }
}

start();
