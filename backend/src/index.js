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
app.use('/api/config', require('./routes/config'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1]?.split(':')[0] : 'none',
  });
});

// Temporary seed endpoint — DELETE AFTER USE
app.post('/api/setup-seed', async (req, res) => {
  const key = req.headers['x-setup-key'];
  if (key !== 'colsein-seed-2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    const bcrypt = require('bcryptjs');
    const hash = (pw) => bcrypt.hashSync(pw, 12);
    const qi = db.sequelize.getQueryInterface();

    // Check if already seeded
    const existing = await db.User.findOne({ where: { email: 'esteban.meza@colsein.co' } });
    if (existing) return res.json({ message: 'Already seeded', seeded: false });

    await qi.bulkInsert('users', [
      { id: 1, nombre: 'Luis Esteban Meza Ardila', cedula: '79627188', email: 'esteban.meza@colsein.co', password_hash: hash('meza2026'), rol: 'comercial', zona: 'Eje Cafetero', vehiculo_tipo: 'CARRO', placa: 'ABC123', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 2, nombre: 'Harol Herrera Diaz', cedula: '80123456', email: 'harol.herrera@colsein.co', password_hash: hash('herrera2026'), rol: 'comercial', zona: 'Bogotá', vehiculo_tipo: 'CARRO', placa: 'JNZ859', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 3, nombre: 'Juan Carlos Pinzón Rodríguez', cedula: '79628000', email: 'juan.pinzon@colsein.co', password_hash: hash('pinzon2026'), rol: 'comercial', zona: 'Antioquia', vehiculo_tipo: 'CARRO', placa: 'DEF456', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 4, nombre: 'Carlos Ramírez', cedula: '1010101010', email: 'carlos.ramirez@colsein.co', password_hash: hash('ramirez2026'), rol: 'lider_regional', zona: 'Nacional', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 5, nombre: 'Biviana Baez', cedula: '2020202020', email: 'biviana.baez@colsein.co', password_hash: hash('admin2026'), rol: 'administrador', zona: 'Nacional', activo: true, created_at: new Date(), updated_at: new Date() },
    ]);

    await qi.bulkInsert('clients', [
      { nombre: 'Tomy', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Hitachi', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Colanta', ciudad: 'Armenia', departamento: 'Quindío', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Suzuki', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Buencafé', ciudad: 'Chinchiná', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'TRULULU', ciudad: 'La Virginia', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'SENA', ciudad: 'Manizales', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'MABE', ciudad: 'Manizales', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'MAGNETRON', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'ALPINA', ciudad: 'Chinchiná', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
    ]);

    await qi.bulkInsert('system_config', [
      { clave: 'tarifa_carro', valor: '600.65', descripcion: 'Tarifa por km para carro (COP)', updated_at: new Date() },
      { clave: 'tarifa_moto', valor: '507.03', descripcion: 'Tarifa por km para moto (COP)', updated_at: new Date() },
      { clave: 'empresa_nombre', valor: 'COLSEIN S.A.S.', descripcion: 'Razón social', updated_at: new Date() },
      { clave: 'empresa_nit', valor: '800002030', descripcion: 'NIT de la empresa', updated_at: new Date() },
      { clave: 'plazo_entrega_km', valor: '5', descripcion: 'Días calendario para entregar reporte de km', updated_at: new Date() },
      { clave: 'plazo_legalizacion', valor: '3', descripcion: 'Días hábiles para legalizar anticipo', updated_at: new Date() },
    ]);

    res.json({ message: 'Seed completed successfully', seeded: true });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
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
