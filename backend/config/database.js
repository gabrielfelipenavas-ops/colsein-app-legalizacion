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
    ...(process.env.DATABASE_URL
      ? {
          use_env_variable: 'DATABASE_URL',
          dialect: 'postgres',
          dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false },
          },
        }
      : {
          username: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME,
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '5432'),
        }),
    dialect: 'postgres',
    logging: false,
    pool: { max: 20, min: 5, acquire: 60000, idle: 10000 },
  },
};
