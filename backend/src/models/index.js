'use strict';
const { Sequelize } = require('sequelize');
const config = require('../../config/database.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = process.env.DATABASE_URL && env === 'production'
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      pool: dbConfig.pool || { max: 10, min: 2, acquire: 30000, idle: 10000 },
    })
  : new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
      pool: dbConfig.pool || { max: 10, min: 2, acquire: 30000, idle: 10000 },
    });

const db = {};

// ── User ──
const User = sequelize.define('User', {
  nombre: { type: Sequelize.STRING(200), allowNull: false },
  cedula: { type: Sequelize.STRING(20), allowNull: false, unique: true },
  email: { type: Sequelize.STRING(100), allowNull: false, unique: true },
  password_hash: { type: Sequelize.STRING(255), allowNull: false },
  rol: { type: Sequelize.ENUM('comercial', 'lider_regional', 'gerente_ventas', 'control_interno', 'administrador'), defaultValue: 'comercial' },
  zona: Sequelize.STRING(100),
  lider_regional_id: Sequelize.INTEGER,
  vehiculo_tipo: { type: Sequelize.ENUM('CARRO', 'MOTO'), defaultValue: 'CARRO' },
  placa: Sequelize.STRING(10),
  telefono: Sequelize.STRING(20),
  activo: { type: Sequelize.BOOLEAN, defaultValue: true },
}, { tableName: 'users', underscored: true });

// ── Client ──
const Client = sequelize.define('Client', {
  nombre: { type: Sequelize.STRING(200), allowNull: false },
  nit: Sequelize.STRING(20),
  direccion: Sequelize.STRING(300),
  ciudad: Sequelize.STRING(100),
  departamento: Sequelize.STRING(100),
  zona: Sequelize.STRING(100),
  latitud: Sequelize.DECIMAL(10, 7),
  longitud: Sequelize.DECIMAL(10, 7),
  contacto_nombre: Sequelize.STRING(200),
  contacto_telefono: Sequelize.STRING(20),
  activo: { type: Sequelize.BOOLEAN, defaultValue: true },
}, { tableName: 'clients', underscored: true });

// ── SystemConfig ──
const SystemConfig = sequelize.define('SystemConfig', {
  clave: { type: Sequelize.STRING(100), allowNull: false, unique: true },
  valor: { type: Sequelize.TEXT, allowNull: false },
  descripcion: Sequelize.STRING(300),
}, { tableName: 'system_config', underscored: true, createdAt: false });

// ── KilometrageReport ──
const KilometrageReport = sequelize.define('KilometrageReport', {
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  periodo_mes: { type: Sequelize.INTEGER, allowNull: false },
  periodo_anio: { type: Sequelize.INTEGER, allowNull: false },
  estado: { type: Sequelize.ENUM('borrador', 'enviado', 'revisado', 'aprobado', 'rechazado'), defaultValue: 'borrador' },
  total_km: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
  total_valor_km: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  total_peajes: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  total_parqueaderos: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  total_taxis: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  total_otros: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  valor_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  observaciones: Sequelize.TEXT,
  revisado_por: Sequelize.INTEGER,
  aprobado_por: Sequelize.INTEGER,
  fecha_envio: Sequelize.DATE,
  fecha_revision: Sequelize.DATE,
  fecha_aprobacion: Sequelize.DATE,
}, { tableName: 'kilometrage_reports', underscored: true });

// ── KilometrageEntry ──
const KilometrageEntry = sequelize.define('KilometrageEntry', {
  report_id: { type: Sequelize.INTEGER, allowNull: false },
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  fecha: { type: Sequelize.DATEONLY, allowNull: false },
  client_id: Sequelize.INTEGER,
  cliente_nombre: { type: Sequelize.STRING(200), allowNull: false },
  medio: { type: Sequelize.ENUM('CARRO', 'MOTO'), allowNull: false },
  km_inicial: { type: Sequelize.DECIMAL(10, 1), defaultValue: 0 },
  km_final: { type: Sequelize.DECIMAL(10, 1), defaultValue: 0 },
  total_km: { type: Sequelize.DECIMAL(10, 1), defaultValue: 0 },
  valor_km: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  peajes: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  parqueaderos: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  taxis: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  taxi_tipo: Sequelize.STRING(50),
  taxi_origen: Sequelize.STRING(200),
  taxi_destino: Sequelize.STRING(200),
  otros: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  origen_lat: Sequelize.DECIMAL(10, 7),
  origen_lng: Sequelize.DECIMAL(10, 7),
  destino_lat: Sequelize.DECIMAL(10, 7),
  destino_lng: Sequelize.DECIMAL(10, 7),
  distancia_api: Sequelize.DECIMAL(10, 2),
  peaje_foto: Sequelize.STRING(500),
  parqueadero_foto: Sequelize.STRING(500),
  taxi_foto: Sequelize.STRING(500),
  otros_foto: Sequelize.STRING(500),
}, { tableName: 'kilometrage_entries', underscored: true });

// ── TravelRequest ──
const TravelRequest = sequelize.define('TravelRequest', {
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  consecutivo: { type: Sequelize.STRING(20), allowNull: false, unique: true },
  destino_tipo: { type: Sequelize.ENUM('NACIONAL', 'INTERNACIONAL'), defaultValue: 'NACIONAL' },
  motivo: { type: Sequelize.TEXT, allowNull: false },
  proceso: Sequelize.STRING(100),
  ciudad_destino: { type: Sequelize.STRING(100), allowNull: false },
  fecha_ida: { type: Sequelize.DATEONLY, allowNull: false },
  fecha_regreso: { type: Sequelize.DATEONLY, allowNull: false },
  duracion_dias: Sequelize.INTEGER,
  alojamiento_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  alimentacion_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  transportes_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  imprevistos_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  representacion_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  presupuesto_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  anticipo_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  estado: { type: Sequelize.ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'anticipo_girado', 'legalizado'), defaultValue: 'borrador' },
  aprobado_por: Sequelize.INTEGER,
  acepta_terminos: { type: Sequelize.BOOLEAN, defaultValue: false },
  fecha_solicitud: Sequelize.DATEONLY,
  fecha_aprobacion: Sequelize.DATE,
  observaciones: Sequelize.TEXT,
}, { tableName: 'travel_requests', underscored: true });

// ── ExpenseLegalization ──
const ExpenseLegalization = sequelize.define('ExpenseLegalization', {
  travel_request_id: Sequelize.INTEGER,
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  ciudades_visitadas: Sequelize.TEXT,
  moneda: { type: Sequelize.STRING(10), defaultValue: 'COP' },
  gasto_real_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  valor_anticipo: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  pago_favor_empresa: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  pago_favor_empleado: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  estado: { type: Sequelize.ENUM('borrador', 'enviado', 'revisado', 'aprobado', 'rechazado'), defaultValue: 'borrador' },
  revisado_por: Sequelize.INTEGER,
  aprobado_por: Sequelize.INTEGER,
  observaciones_imprevistos: Sequelize.TEXT,
}, { tableName: 'expense_legalizations', underscored: true });

// ── Expense ──
const Expense = sequelize.define('Expense', {
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  legalization_id: Sequelize.INTEGER,
  kilometrage_entry_id: Sequelize.INTEGER,
  categoria: { type: Sequelize.ENUM('alojamiento', 'alimentacion', 'transportes', 'imprevistos', 'representacion', 'peaje', 'parqueadero', 'taxi', 'otro'), allowNull: false },
  fecha: { type: Sequelize.DATEONLY, allowNull: false },
  establecimiento: Sequelize.STRING(300),
  nit_establecimiento: Sequelize.STRING(20),
  direccion: Sequelize.STRING(300),
  valor: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
  iva: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
  medio_pago: { type: Sequelize.ENUM('efectivo', 'tarjeta_debito', 'tarjeta_credito'), defaultValue: 'efectivo' },
  numero_factura: Sequelize.STRING(50),
  cufe: Sequelize.STRING(200),
  imagen_url: Sequelize.STRING(500),
  imagen_thumbnail: Sequelize.STRING(500),
  datos_ocr: Sequelize.JSONB,
  validado: { type: Sequelize.BOOLEAN, defaultValue: false },
  observaciones: Sequelize.TEXT,
}, { tableName: 'expenses', underscored: true });

// ── Approval ──
const Approval = sequelize.define('Approval', {
  tipo: { type: Sequelize.ENUM('kilometraje', 'anticipo', 'legalizacion'), allowNull: false },
  referencia_id: { type: Sequelize.INTEGER, allowNull: false },
  aprobador_id: { type: Sequelize.INTEGER, allowNull: false },
  rol_aprobador: Sequelize.STRING(50),
  estado: { type: Sequelize.ENUM('aprobado', 'rechazado'), allowNull: false },
  comentarios: Sequelize.TEXT,
}, { tableName: 'approvals', underscored: true, updatedAt: false });

// ── ASSOCIATIONS ──
User.hasMany(KilometrageReport, { foreignKey: 'user_id' });
KilometrageReport.belongsTo(User, { foreignKey: 'user_id' });

KilometrageReport.hasMany(KilometrageEntry, { foreignKey: 'report_id', as: 'entries' });
KilometrageEntry.belongsTo(KilometrageReport, { foreignKey: 'report_id' });
KilometrageEntry.belongsTo(User, { foreignKey: 'user_id' });
KilometrageEntry.belongsTo(Client, { foreignKey: 'client_id' });

User.hasMany(TravelRequest, { foreignKey: 'user_id' });
TravelRequest.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ExpenseLegalization, { foreignKey: 'user_id' });
ExpenseLegalization.belongsTo(User, { foreignKey: 'user_id' });
ExpenseLegalization.belongsTo(TravelRequest, { foreignKey: 'travel_request_id' });
ExpenseLegalization.hasMany(Expense, { foreignKey: 'legalization_id', as: 'expenses' });

User.hasMany(Expense, { foreignKey: 'user_id' });
Expense.belongsTo(User, { foreignKey: 'user_id' });
Expense.belongsTo(ExpenseLegalization, { foreignKey: 'legalization_id' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.User = User;
db.Client = Client;
db.SystemConfig = SystemConfig;
db.KilometrageReport = KilometrageReport;
db.KilometrageEntry = KilometrageEntry;
db.TravelRequest = TravelRequest;
db.ExpenseLegalization = ExpenseLegalization;
db.Expense = Expense;
db.Approval = Approval;

module.exports = db;
