require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ──
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173'), credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(path.resolve(uploadDir)));

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
