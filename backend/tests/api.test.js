// Pruebas de integración del API (supertest + PostgreSQL de pruebas).
// Cubren: login, IDOR de kilometraje, flujo de aprobación jerárquico,
// bloqueo tras envío y cálculo de totales.
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/models');

// Usuarios de los seeds de demostración
const COMERCIAL = { email: 'esteban.meza@colsein.co', password: 'meza2026' };       // id 1
const COMERCIAL2 = { email: 'harol.herrera@colsein.co', password: 'herrera2026' };  // id 2
const LIDER = { email: 'carlos.ramirez@colsein.co', password: 'ramirez2026' };      // id 4
const GERENTE = { email: 'gerente.ventas@colsein.co', password: 'gerente2026' };

async function login(user) {
  const res = await request(app).post('/api/auth/login').send(user);
  expect(res.status).toBe(200);
  return res.body.token;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

afterAll(async () => {
  await db.sequelize.close();
});

describe('Autenticación', () => {
  test('login correcto devuelve token y usuario sin password_hash', async () => {
    const res = await request(app).post('/api/auth/login').send(COMERCIAL);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('contraseña incorrecta y correo inexistente devuelven el MISMO mensaje (sin enumeración)', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ email: COMERCIAL.email, password: 'malamala' });
    const r2 = await request(app).post('/api/auth/login').send({ email: 'no.existe@colsein.co', password: 'malamala' });
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r1.body.error).toBe(r2.body.error);
  });

  test('endpoint protegido sin token devuelve 401', async () => {
    const res = await request(app).get('/api/kilometraje/reports');
    expect(res.status).toBe(401);
  });

  test('los archivos subidos (/uploads) exigen sesión', async () => {
    const res = await request(app).get('/uploads/cualquiera.jpg');
    expect(res.status).toBe(401);
  });
});

describe('Kilometraje: IDOR, flujo de aprobación, bloqueo y totales', () => {
  let tokenA, tokenB, tokenLider, tokenGerente;
  let entryId, reportId;

  beforeAll(async () => {
    tokenA = await login(COMERCIAL);
    tokenB = await login(COMERCIAL2);
    tokenLider = await login(LIDER);
    tokenGerente = await login(GERENTE);
  });

  test('crear registros calcula el valor con la tarifa del servidor', async () => {
    const res = await request(app).post('/api/kilometraje/entries').set(auth(tokenA)).send({
      fecha: '2026-06-10', cliente_nombre: 'Cliente Test A', medio: 'CARRO', km_inicial: 100, km_final: 150,
      peajes: 12500,
    });
    expect(res.status).toBe(201);
    entryId = res.body.id;
    reportId = res.body.report_id;
    // 50 km * $600.65 = $30.032,50
    expect(parseFloat(res.body.valor_km)).toBeCloseTo(30032.5, 2);

    const res2 = await request(app).post('/api/kilometraje/entries').set(auth(tokenA)).send({
      fecha: '2026-06-11', cliente_nombre: 'Cliente Test B', medio: 'MOTO', km_inicial: 0, km_final: 33,
    });
    expect(res2.status).toBe(201);
    // 33 km * $507.03 = $16.731,99
    expect(parseFloat(res2.body.valor_km)).toBeCloseTo(16731.99, 2);
  });

  test('los totales del reporte cuadran con la suma de sus registros', async () => {
    const res = await request(app).get(`/api/kilometraje/reports/${reportId}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    const r = res.body;
    expect(parseFloat(r.total_km)).toBeCloseTo(83, 1);
    expect(parseFloat(r.total_valor_km)).toBeCloseTo(30032.5 + 16731.99, 2);
    expect(parseFloat(r.valor_total)).toBeCloseTo(30032.5 + 16731.99 + 12500, 2);
  });

  test('IDOR: otro comercial NO puede ver, editar ni borrar registros/reportes ajenos', async () => {
    const ver = await request(app).get(`/api/kilometraje/reports/${reportId}`).set(auth(tokenB));
    expect(ver.status).toBe(403);

    const editar = await request(app).put(`/api/kilometraje/entries/${entryId}`).set(auth(tokenB)).send({ km_final: 9999 });
    expect(editar.status).toBe(404); // no revela existencia

    const borrar = await request(app).delete(`/api/kilometraje/entries/${entryId}`).set(auth(tokenB));
    expect(borrar.status).toBe(404);

    const enviar = await request(app).post(`/api/kilometraje/reports/${reportId}/submit`).set(auth(tokenB));
    expect(enviar.status).toBe(404);
  });

  test('no se puede aprobar un reporte en borrador (nunca enviado)', async () => {
    const res = await request(app).post(`/api/kilometraje/reports/${reportId}/approve`)
      .set(auth(tokenLider)).send({ action: 'aprobar' });
    expect(res.status).toBe(409);
  });

  test('falta de foto de peaje impide el envío', async () => {
    const res = await request(app).post(`/api/kilometraje/reports/${reportId}/submit`).set(auth(tokenA));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/peaje/i);
  });

  test('flujo completo: enviar → líder revisa → gerente aprueba; bloqueos en cada paso', async () => {
    // Quitar el peaje para poder enviar sin foto
    const upd = await request(app).put(`/api/kilometraje/entries/${entryId}`).set(auth(tokenA)).send({ peajes: 0 });
    expect(upd.status).toBe(200);

    const env = await request(app).post(`/api/kilometraje/reports/${reportId}/submit`).set(auth(tokenA));
    expect(env.status).toBe(200);
    expect(env.body.estado).toBe('enviado');

    // Bloqueado tras el envío: no se puede editar, borrar ni agregar
    const editar = await request(app).put(`/api/kilometraje/entries/${entryId}`).set(auth(tokenA)).send({ km_final: 999 });
    expect(editar.status).toBe(409);
    const agregar = await request(app).post('/api/kilometraje/entries').set(auth(tokenA)).send({
      fecha: '2026-06-12', cliente_nombre: 'Colado', medio: 'CARRO', km_inicial: 0, km_final: 10,
    });
    expect(agregar.status).toBe(409);
    const reenviar = await request(app).post(`/api/kilometraje/reports/${reportId}/submit`).set(auth(tokenA));
    expect(reenviar.status).toBe(409);

    // El dueño no puede aprobarse (no es aprobador → 403)
    const auto = await request(app).post(`/api/kilometraje/reports/${reportId}/approve`)
      .set(auth(tokenA)).send({ action: 'aprobar' });
    expect(auto.status).toBe(403);

    // El líder regional revisa
    const rev = await request(app).post(`/api/kilometraje/reports/${reportId}/approve`)
      .set(auth(tokenLider)).send({ action: 'aprobar' });
    expect(rev.status).toBe(200);
    expect(rev.body.estado).toBe('revisado');

    // El gerente de ventas aprueba
    const apr = await request(app).post(`/api/kilometraje/reports/${reportId}/approve`)
      .set(auth(tokenGerente)).send({ action: 'aprobar' });
    expect(apr.status).toBe(200);
    expect(apr.body.estado).toBe('aprobado');

    // Nadie puede re-decidir un reporte ya aprobado
    const redecidir = await request(app).post(`/api/kilometraje/reports/${reportId}/approve`)
      .set(auth(tokenGerente)).send({ action: 'rechazar', comentarios: 'tarde' });
    expect(redecidir.status).toBe(409);
  });

  test('rechazar exige comentario', async () => {
    // Nuevo reporte de otro mes para probar el rechazo
    const e = await request(app).post('/api/kilometraje/entries').set(auth(tokenA)).send({
      fecha: '2026-05-05', cliente_nombre: 'Cliente Mayo', medio: 'CARRO', km_inicial: 0, km_final: 10,
    });
    expect(e.status).toBe(201);
    const rid = e.body.report_id;
    await request(app).post(`/api/kilometraje/reports/${rid}/submit`).set(auth(tokenA)).expect(200);

    const sinComentario = await request(app).post(`/api/kilometraje/reports/${rid}/approve`)
      .set(auth(tokenLider)).send({ action: 'rechazar' });
    expect(sinComentario.status).toBe(400);

    const rech = await request(app).post(`/api/kilometraje/reports/${rid}/approve`)
      .set(auth(tokenLider)).send({ action: 'rechazar', comentarios: 'Kilometraje no corresponde a la zona' });
    expect(rech.status).toBe(200);
    expect(rech.body.estado).toBe('rechazado');

    // Tras el rechazo el dueño puede corregir y reenviar
    const reenv = await request(app).post(`/api/kilometraje/reports/${rid}/submit`).set(auth(tokenA));
    expect(reenv.status).toBe(200);
    expect(reenv.body.estado).toBe('enviado');
  });
});

describe('Legalizaciones: bloqueo tras envío y protección de gastos', () => {
  let tokenA, tokenB, tokenGerente;
  let legId, expenseId;

  beforeAll(async () => {
    tokenA = await login(COMERCIAL);
    tokenB = await login(COMERCIAL2);
    tokenGerente = await login(GERENTE);
  });

  test('crear gasto y legalización, asociarlos y calcular totales', async () => {
    const g = await request(app).post('/api/expenses').set(auth(tokenA)).send({
      categoria: 'alimentacion', fecha: '2026-06-15', establecimiento: 'Restaurante Test',
      valor: 50000, iva: 5000, propina: 3000,
    });
    expect(g.status).toBe(201);
    expenseId = g.body.id;
    // Legalizable: base = 50000-5000-3000 = 42000; +IVA 5000 = 47000 (propina excluida)
    expect(parseFloat(g.body.valor_legalizable)).toBeCloseTo(47000, 2);

    const l = await request(app).post('/api/legalizations').set(auth(tokenA)).send({ tipo: 'local', motivo: 'Prueba' });
    expect(l.status).toBe(201);
    legId = l.body.id;

    const asoc = await request(app).put(`/api/legalizations/${legId}/expenses`).set(auth(tokenA))
      .send({ expense_ids: [expenseId] });
    expect(asoc.status).toBe(200);
    expect(parseFloat(asoc.body.gasto_real_total)).toBeCloseTo(47000, 2);
  });

  test('IDOR: otro usuario no puede ver ni editar la legalización', async () => {
    const ver = await request(app).get(`/api/legalizations/${legId}`).set(auth(tokenB));
    expect(ver.status).toBe(403);
    const editar = await request(app).put(`/api/legalizations/${legId}`).set(auth(tokenB)).send({ ciudades_visitadas: 'Hackeo' });
    expect(editar.status).toBe(403);
  });

  test('enviada queda bloqueada: ni la legalización ni sus gastos se pueden tocar', async () => {
    const env = await request(app).post(`/api/legalizations/${legId}/submit`).set(auth(tokenA));
    expect(env.status).toBe(200);
    expect(env.body.estado).toBe('enviado');

    const reenv = await request(app).post(`/api/legalizations/${legId}/submit`).set(auth(tokenA));
    expect(reenv.status).toBe(409);

    const editarLeg = await request(app).put(`/api/legalizations/${legId}`).set(auth(tokenA)).send({ valor_anticipo: 1 });
    expect(editarLeg.status).toBe(409);

    const editarGastos = await request(app).put(`/api/legalizations/${legId}/expenses`).set(auth(tokenA)).send({ expense_ids: [] });
    expect(editarGastos.status).toBe(409);

    // El gasto asociado tampoco se puede editar ni borrar (evasión del bloqueo)
    const editarGasto = await request(app).put(`/api/expenses/${expenseId}`).set(auth(tokenA)).send({ valor: 999999 });
    expect(editarGasto.status).toBe(409);
    const borrarGasto = await request(app).delete(`/api/expenses/${expenseId}`).set(auth(tokenA));
    expect(borrarGasto.status).toBe(409);
  });

  test('un gasto de una legalización enviada no puede asociarse a otra legalización', async () => {
    const l2 = await request(app).post('/api/legalizations').set(auth(tokenA)).send({ tipo: 'local' });
    expect(l2.status).toBe(201);
    const asoc = await request(app).put(`/api/legalizations/${l2.body.id}/expenses`).set(auth(tokenA))
      .send({ expense_ids: [expenseId] });
    expect(asoc.status).toBe(409);
  });

  test('jerarquía: el dueño no aprueba; el gerente sí; no se decide dos veces', async () => {
    const auto = await request(app).post(`/api/legalizations/${legId}/approve`).set(auth(tokenA)).send({ action: 'aprobar' });
    expect(auto.status).toBe(403); // comercial no es aprobador

    const apr = await request(app).post(`/api/legalizations/${legId}/approve`).set(auth(tokenGerente)).send({ action: 'aprobar' });
    expect(apr.status).toBe(200);
    expect(apr.body.estado).toBe('aprobado');

    const otra = await request(app).post(`/api/legalizations/${legId}/approve`).set(auth(tokenGerente)).send({ action: 'rechazar', comentarios: 'x' });
    expect(otra.status).toBe(409);
  });

  test('autorización de modificación aprobada devuelve la legalización a borrador', async () => {
    const sol = await request(app).post('/api/authorizations').set(auth(tokenA)).send({
      tipo: 'modificacion', concepto: 'Corregir valor de un gasto', ref_tipo: 'legalizacion', ref_id: legId,
    });
    expect(sol.status).toBe(201);
    expect(sol.body.estado).toBe('pendiente');

    // El propio usuario no puede autorizarse (no es autorizador → 403)
    const autoDecide = await request(app).post(`/api/authorizations/${sol.body.id}/decide`).set(auth(tokenA)).send({ action: 'autorizar' });
    expect(autoDecide.status).toBe(403);

    const dec = await request(app).post(`/api/authorizations/${sol.body.id}/decide`).set(auth(tokenGerente)).send({ action: 'autorizar' });
    expect(dec.status).toBe(200);

    const leg = await request(app).get(`/api/legalizations/${legId}`).set(auth(tokenA));
    expect(leg.body.estado).toBe('borrador');

    // Desbloqueada: ahora sí se puede editar el gasto
    const editarGasto = await request(app).put(`/api/expenses/${expenseId}`).set(auth(tokenA)).send({ observaciones: 'corregido' });
    expect(editarGasto.status).toBe(200);
  });
});

describe('Administración y validaciones varias', () => {
  let tokenA;
  beforeAll(async () => { tokenA = await login(COMERCIAL); });

  test('un comercial no puede listar usuarios ni cambiar la configuración', async () => {
    const usuarios = await request(app).get('/api/users').set(auth(tokenA));
    expect(usuarios.status).toBe(403);
    const conf = await request(app).put('/api/config/tarifa_carro').set(auth(tokenA)).send({ valor: '1' });
    expect(conf.status).toBe(403);
    const imp = await request(app).post('/api/clients/import').set(auth(tokenA));
    expect(imp.status).toBe(403);
  });

  test('valores monetarios negativos se rechazan', async () => {
    const km = await request(app).post('/api/kilometraje/entries').set(auth(tokenA)).send({
      fecha: '2026-04-10', cliente_nombre: 'X', medio: 'CARRO', km_inicial: 10, km_final: 5,
    });
    expect(km.status).toBe(400); // km final < inicial

    const gasto = await request(app).post('/api/expenses').set(auth(tokenA)).send({
      categoria: 'alimentacion', fecha: '2026-06-15', valor: -100,
    });
    expect(gasto.status).toBe(400);
  });

  test('la fecha futura de un gasto se rechaza', async () => {
    const gasto = await request(app).post('/api/expenses').set(auth(tokenA)).send({
      categoria: 'alimentacion', fecha: '2030-01-01', valor: 1000,
    });
    expect(gasto.status).toBe(400);
  });

  test('cambiar contraseña exige la contraseña actual', async () => {
    const res = await request(app).put('/api/auth/password').set(auth(tokenA))
      .send({ current_password: 'incorrecta', new_password: 'nueva-clave-123' });
    expect(res.status).toBe(400);
  });
});
