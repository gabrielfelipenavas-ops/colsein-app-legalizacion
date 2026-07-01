require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'colsein_gastos',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false,
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    // TLS hacia la BD. Por defecto no se verifica el certificado (Railway usa
    // certificados autofirmados); si tu proveedor entrega un CA verificable,
    // define DB_SSL_VERIFY=true para exigir la verificación (evita MITM).
    dialectOptions: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('.railway.internal')
      ? {}
      : { ssl: { require: true, rejectUnauthorized: process.env.DB_SSL_VERIFY === 'true' } },
    pool: { max: 20, min: 5, acquire: 60000, idle: 10000 },
  },
};
