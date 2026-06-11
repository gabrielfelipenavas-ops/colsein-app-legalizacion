const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');
const { estimateRoute } = require('../services/distance');

// Tarifas vigentes (config en BD, con respaldo por env y por defecto)
async function getTarifas() {
  const carro = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || process.env.TARIFA_CARRO || '600.65');
  const moto = parseFloat((await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || process.env.TARIFA_MOTO || '507.03');
  return { carro, moto };
}

// Normaliza un punto recibido del cliente
function normPoint(p, orden) {
  const lat = Number(p?.lat);
  const lng = Number(p?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tipos = ['salida', 'visita', 'regreso'];
  return {
    orden,
    tipo: tipos.includes(p?.tipo) ? p.tipo : 'visita',
    label: (p?.label ? String(p.label) : '').slice(0, 200) || null,
    lat,
    lng,
    ts: p?.ts ? String(p.ts).slice(0, 40) : null,
  };
}

// Recalcula la estimación del recorrido a partir de sus puntos y la guarda
async function recomputeTrip(trip) {
  const puntos = trip.puntos || [];
  const est = await estimateRoute(puntos.map((p) => ({ lat: p.lat, lng: p.lng })));
  trip.legs = est.legs || [];
  trip.metodo = est.metodo;
  trip.total_km_estimado = est.total_km;
  await trip.save();
  return trip;
}

// POST /api/trips/estimate — estimar km de una lista de puntos (sin guardar nada).
// Sirve para el registro manual de kilometraje cuando no hubo odómetro.
router.post('/estimate', auth, async (req, res) => {
  try {
    const puntos = Array.isArray(req.body.puntos) ? req.body.puntos : [];
    const est = await estimateRoute(puntos.map((p) => ({ lat: p.lat, lng: p.lng })));
    res.json(est);
  } catch (err) {
    console.error('Estimate error:', err);
    res.status(500).json({ error: 'No se pudo estimar la distancia' });
  }
});

// GET /api/trips?mes&anio — recorridos del usuario
router.get('/', auth, async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    const reqs = await db.Trip.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
    let list = reqs;
    if (req.query.mes && req.query.anio) {
      const mes = parseInt(req.query.mes), anio = parseInt(req.query.anio);
      list = reqs.filter((t) => {
        const d = new Date(t.fecha);
        return d.getMonth() + 1 === mes && d.getFullYear() === anio;
      });
    }
    res.json(list);
  } catch (err) {
    console.error('List trips error:', err);
    res.status(500).json({ error: 'Error al obtener recorridos' });
  }
});

// POST /api/trips — iniciar recorrido con el primer punto (salida)
router.post('/', auth, async (req, res) => {
  try {
    const { medio, fecha, punto } = req.body;
    const p = normPoint({ ...punto, tipo: 'salida' }, 0);
    if (!p) return res.status(400).json({ error: 'Ubicación de salida inválida. Activa el GPS e intenta de nuevo.' });

    const trip = await db.Trip.create({
      user_id: req.user.id,
      fecha: fecha || new Date().toISOString().split('T')[0],
      medio: medio === 'MOTO' ? 'MOTO' : 'CARRO',
      estado: 'en_curso',
      puntos: [p],
      legs: [],
      total_km_estimado: 0,
    });
    res.status(201).json(trip);
  } catch (err) {
    console.error('Create trip error:', err);
    res.status(500).json({ error: 'No se pudo iniciar el recorrido' });
  }
});

// POST /api/trips/:id/points — agregar una parada (llegada a visita o regreso)
router.post('/:id/points', auth, async (req, res) => {
  try {
    const trip = await db.Trip.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!trip) return res.status(404).json({ error: 'Recorrido no encontrado' });
    if (trip.estado === 'confirmado') return res.status(400).json({ error: 'Este recorrido ya fue confirmado' });

    const puntos = [...(trip.puntos || [])];
    const p = normPoint(req.body, puntos.length);
    if (!p) return res.status(400).json({ error: 'Ubicación inválida. Activa el GPS e intenta de nuevo.' });
    puntos.push(p);
    trip.puntos = puntos;
    await trip.save();

    await recomputeTrip(trip);
    res.json(trip);
  } catch (err) {
    console.error('Add point error:', err);
    res.status(500).json({ error: 'No se pudo registrar la ubicación' });
  }
});

// DELETE /api/trips/:id/points/last — deshacer la última parada
router.delete('/:id/points/last', auth, async (req, res) => {
  try {
    const trip = await db.Trip.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!trip) return res.status(404).json({ error: 'Recorrido no encontrado' });
    if (trip.estado === 'confirmado') return res.status(400).json({ error: 'Este recorrido ya fue confirmado' });
    const puntos = [...(trip.puntos || [])];
    if (puntos.length <= 1) return res.status(400).json({ error: 'No se puede quitar el punto de salida' });
    puntos.pop();
    trip.puntos = puntos;
    await trip.save();
    await recomputeTrip(trip);
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: 'Error al deshacer la parada' });
  }
});

// POST /api/trips/:id/finish — cerrar recorrido (opcionalmente con punto de regreso)
router.post('/:id/finish', auth, async (req, res) => {
  try {
    const trip = await db.Trip.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!trip) return res.status(404).json({ error: 'Recorrido no encontrado' });
    if (trip.estado === 'confirmado') return res.status(400).json({ error: 'Este recorrido ya fue confirmado' });

    if (req.body?.punto) {
      const puntos = [...(trip.puntos || [])];
      const p = normPoint({ ...req.body.punto, tipo: 'regreso' }, puntos.length);
      if (p) { puntos.push(p); trip.puntos = puntos; await trip.save(); }
    }
    trip.estado = 'finalizado';
    await trip.save();
    await recomputeTrip(trip);
    res.json(trip);
  } catch (err) {
    console.error('Finish trip error:', err);
    res.status(500).json({ error: 'No se pudo finalizar el recorrido' });
  }
});

// POST /api/trips/:id/confirm — confirma el total y crea las entradas de km
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const trip = await db.Trip.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!trip) return res.status(404).json({ error: 'Recorrido no encontrado' });
    if (trip.estado === 'confirmado') return res.status(400).json({ error: 'Este recorrido ya fue confirmado' });

    const puntos = trip.puntos || [];
    if (puntos.length < 2) return res.status(400).json({ error: 'Registra al menos la salida y una llegada' });

    // Total confirmado (el vendedor pudo ajustarlo); si no, usar el estimado
    let totalConfirmado = req.body?.total_km != null ? parseFloat(req.body.total_km) : parseFloat(trip.total_km_estimado || 0);
    if (Number.isNaN(totalConfirmado) || totalConfirmado < 0) {
      return res.status(400).json({ error: 'El total de kilómetros no es válido' });
    }
    totalConfirmado = Math.round(totalConfirmado * 100) / 100;

    // Reporte del mes (se crea si no existe)
    const d = new Date(trip.fecha);
    const mes = d.getMonth() + 1, anio = d.getFullYear();
    const [report] = await db.KilometrageReport.findOrCreate({
      where: { user_id: req.user.id, periodo_mes: mes, periodo_anio: anio },
      defaults: { user_id: req.user.id, periodo_mes: mes, periodo_anio: anio, estado: 'borrador' },
    });
    if (report.estado === 'aprobado') {
      return res.status(400).json({ error: 'El reporte de ese mes ya está aprobado y no se puede modificar' });
    }

    const { carro, moto } = await getTarifas();
    const tarifa = trip.medio === 'CARRO' ? carro : moto;

    // Distribuir el total confirmado proporcionalmente entre los tramos
    const legs = (trip.legs && trip.legs.length) ? trip.legs : [];
    const sumLegs = legs.reduce((s, l) => s + parseFloat(l.km || 0), 0);
    const numLegs = Math.max(1, puntos.length - 1);
    const repartido = legs.length
      ? legs.map((l) => (sumLegs > 0 ? (parseFloat(l.km || 0) / sumLegs) * totalConfirmado : totalConfirmado / numLegs))
      : Array.from({ length: numLegs }, () => totalConfirmado / numLegs);

    // Crear una entrada por tramo (destino = a dónde llegó)
    let acumulado = 0;
    const creadas = [];
    for (let i = 1; i < puntos.length; i++) {
      const desde = puntos[i - 1];
      const hasta = puntos[i];
      let km = Math.round((repartido[i - 1] || 0) * 10) / 10;
      // Ajuste de redondeo en el último tramo para que el total cuadre exacto
      if (i === puntos.length - 1) km = Math.round((totalConfirmado - acumulado) * 10) / 10;
      acumulado += km;
      const valorKm = Math.round(km * tarifa * 100) / 100;
      const nombre = hasta.tipo === 'regreso' ? 'Regreso' : (hasta.label || 'Visita');
      // Estimado GPS del tramo (lo que el aprobador podrá comparar contra lo confirmado)
      const estLeg = legs[i - 1] ? Math.round(parseFloat(legs[i - 1].km || 0) * 10) / 10 : km;

      const entry = await db.KilometrageEntry.create({
        report_id: report.id,
        user_id: req.user.id,
        fecha: trip.fecha,
        cliente_nombre: nombre,
        medio: trip.medio,
        km_inicial: 0,
        km_final: 0,
        total_km: km,          // lo que el usuario confirmó (cuenta para el reembolso)
        valor_km: valorKm,
        peajes: 0, parqueaderos: 0, taxis: 0, otros: 0,
        origen_lat: desde.lat, origen_lng: desde.lng,
        destino_lat: hasta.lat, destino_lng: hasta.lng,
        distancia_api: estLeg, // estimado GPS (para comparar)
      });
      creadas.push(entry.id);
    }

    // Recalcular totales del reporte
    await recalcReport(report.id);

    trip.estado = 'confirmado';
    trip.total_km_confirmado = totalConfirmado;
    trip.report_id = report.id;
    await trip.save();

    res.json({ trip, report_id: report.id, entries_creadas: creadas.length });
  } catch (err) {
    console.error('Confirm trip error:', err);
    res.status(500).json({ error: 'No se pudo confirmar el recorrido' });
  }
});

// DELETE /api/trips/:id — borrar un recorrido (no borra entradas ya confirmadas)
router.delete('/:id', auth, async (req, res) => {
  try {
    const trip = await db.Trip.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!trip) return res.status(404).json({ error: 'Recorrido no encontrado' });
    await trip.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el recorrido' });
  }
});

// Recalcula los totales de un reporte sumando sus entradas
async function recalcReport(reportId) {
  const entries = await db.KilometrageEntry.findAll({ where: { report_id: reportId } });
  const totals = entries.reduce((acc, e) => ({
    total_km: acc.total_km + parseFloat(e.total_km || 0),
    total_valor_km: acc.total_valor_km + parseFloat(e.valor_km || 0),
    total_peajes: acc.total_peajes + parseFloat(e.peajes || 0),
    total_parqueaderos: acc.total_parqueaderos + parseFloat(e.parqueaderos || 0),
    total_taxis: acc.total_taxis + parseFloat(e.taxis || 0),
    total_otros: acc.total_otros + parseFloat(e.otros || 0),
  }), { total_km: 0, total_valor_km: 0, total_peajes: 0, total_parqueaderos: 0, total_taxis: 0, total_otros: 0 });
  totals.valor_total = totals.total_valor_km + totals.total_peajes + totals.total_parqueaderos + totals.total_taxis + totals.total_otros;
  await db.KilometrageReport.update(totals, { where: { id: reportId } });
}

module.exports = router;
