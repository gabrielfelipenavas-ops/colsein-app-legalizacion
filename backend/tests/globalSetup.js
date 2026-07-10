// Prepara la base de datos de pruebas: la crea (si no existe), corre las
// migraciones y los seeds de demostración. Requiere PostgreSQL local.
const { execSync } = require('child_process');

module.exports = async () => {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET || 'secreto-de-pruebas-no-usar-en-produccion-0123456789',
  };
  const run = (cmd, ignoreError = false) => {
    try {
      execSync(cmd, { cwd: __dirname + '/..', env, stdio: 'pipe' });
    } catch (err) {
      if (!ignoreError) throw err;
    }
  };
  run('npx sequelize-cli db:create', true); // puede existir ya
  run('npx sequelize-cli db:migrate:undo:all', true);
  run('npx sequelize-cli db:migrate');
  run('npx sequelize-cli db:seed:all');

  // Los seeds insertan IDs explícitos sin avanzar las secuencias de Postgres;
  // sin este ajuste, el siguiente INSERT por API choca con una PK existente.
  process.env.NODE_ENV = 'test';
  const db = require('../src/models');
  const [tables] = await db.sequelize.query(
    `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='id'`
  );
  for (const { table_name } of tables) {
    await db.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('"${table_name}"','id'), COALESCE((SELECT MAX(id) FROM "${table_name}"), 0) + 1, false)`
    ).catch(() => {});
  }
  await db.sequelize.close();
};
