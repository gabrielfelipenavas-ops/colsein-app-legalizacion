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
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Permitir las imágenes de los mapas (OpenStreetMap) sin abrir el resto de la política.
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://*.openstreetmap.org'],
    },
  },
}));
// CORS: en producción solo se permite el origen configurado (FRONTEND_URL). Si no se
// configura, no se habilita CORS cruzado (la app se sirve desde el mismo origen).
app.use(cors({ origin: process.env.FRONTEND_URL || (isProd ? false : 'http://localhost:5173'), credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Detrás del proxy de Railway: confiar en 1 salto para identificar la IP real (rate limiting)
app.set('trust proxy', 1);

// ── LÍMITE DE PETICIONES (anti fuerza bruta y abuso) ──
// La clave del límite es POR USUARIO cuando hay sesión (token JWT) y por IP en
// caso contrario. Así, si 60 personas comparten la misma IP pública de la
// oficina, cada una tiene su propio cupo y no se bloquean entre sí.
const userOrIpKey = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return 'user:' + authHeader.slice(7);
  return 'ip:' + req.ip;
};

// Login: seguimos contando por IP (no hay token todavía), pero SOLO los intentos
// FALLIDOS, para no bloquear a una oficina entera que inicia sesión bien desde la
// misma IP al empezar el día. Protege contra fuerza bruta sin afectar a usuarios reales.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
});
app.use('/api/auth/login', loginLimiter);
// Límite general por usuario (o por IP si no hay sesión): holgado para uso diario.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Demasiadas peticiones. Espera un momento e intenta de nuevo.' },
}));

// Static uploads — se sirven con cabeceras que impiden que el navegador interprete
// (ejecute) el archivo. Junto con el filtro de tipos, evita el XSS por archivos subidos.
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
// En plataformas como Railway el disco es EFÍMERO (se vacía en cada
// redespliegue). Por eso cada archivo subido se guarda también en la tabla
// `archivos` de PostgreSQL y se restaura al disco cuando hace falta
// (services/archivos.js). Un volumen persistente + UPLOAD_DIR es opcional.
console.log(`📁 Archivos subidos en: ${path.resolve(uploadDir)} (con copia permanente en la base de datos)`);
// Si el archivo no está en el disco (p. ej. tras un redespliegue en Railway),
// se restaura desde la copia permanente en la base de datos antes de servirlo.
const archivos = require('./services/archivos');
app.use('/uploads', (req, res, next) => {
  const rel = archivos.relDesdeUrl('/uploads/' + req.path.replace(/^\/+/, ''));
  if (!rel) return next();
  if (fs.existsSync(path.join(path.resolve(uploadDir), rel))) return next();
  archivos.asegurar(rel).then(() => next()).catch(() => next());
});
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
app.use('/api/trips', require('./routes/trips'));
app.use('/api/authorizations', require('./routes/authorizations'));
app.use('/api/establishments', require('./routes/establishments'));
app.use('/api/accounting', require('./routes/accounting'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Serve frontend in production (o siempre que exista el build compilado).
// No dependemos solo de NODE_ENV: si el frontend está compilado en
// frontend/dist, lo servimos. Así la app se ve aunque la plataforma de
// despliegue no haya fijado NODE_ENV=production.
const frontendPath = path.join(__dirname, '../../frontend/dist');
const hasFrontendBuild = fs.existsSync(path.join(frontendPath, 'index.html'));
if (isProd || hasFrontendBuild) {
  if (!hasFrontendBuild) {
    console.warn('⚠️  No se encontró frontend/dist/index.html. ¿Se ejecutó el build del frontend?');
  }
  // Los assets tienen nombre con hash (cache larga); index.html NUNCA se cachea,
  // así el navegador siempre carga la versión más reciente tras cada despliegue.
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    },
  }));
  // SPA fallback: cualquier ruta que no sea /api ni /uploads devuelve index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
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
    // Copia permanente de los archivos que ya estén en el disco y aún no estén
    // en la BD (subidos antes de esta mejora). En segundo plano.
    archivos.respaldarDirectorio()
      .then(r => { if (r.guardados) console.log(`📦 ${r.guardados} archivo(s) del disco respaldados en la base de datos`); })
      .catch(err => console.error('[archivos] Respaldo inicial falló:', err.message));
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
