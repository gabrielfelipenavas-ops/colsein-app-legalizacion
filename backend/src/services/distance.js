// Estimación de distancia de un recorrido (varios puntos en orden), SIN costo.
//
// Estrategia (acordada): intentar primero un servicio de rutas gratuito por
// carretera (OpenRouteService, requiere ORS_API_KEY gratuita); si no hay llave,
// falla, da timeout o se agota el límite, caer automáticamente a un cálculo
// interno (Haversine entre puntos consecutivos × factor de carretera).

const ROAD_FACTOR = parseFloat(process.env.ROAD_FACTOR || '1.3');

// Distancia geográfica (línea recta) entre dos coordenadas, en kilómetros.
function haversineKm(a, b) {
  const R = 6371; // radio terrestre en km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Cálculo interno (siempre disponible, gratis): suma de tramos rectos × factor.
function estimateInternal(points) {
  const legs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const km = haversineKm(points[i - 1], points[i]) * ROAD_FACTOR;
    legs.push({ km: Math.round(km * 100) / 100 });
    total += km;
  }
  return { total_km: Math.round(total * 100) / 100, metodo: 'interno', legs };
}

// Cálculo por carretera real con OpenRouteService. Una sola petición que pasa
// por todos los puntos en orden. Devuelve null si no se puede (sin llave/error).
async function estimateOrs(points) {
  const key = process.env.ORS_API_KEY;
  if (!key || points.length < 2) return null;

  const coordinates = points.map((p) => [p.lng, p.lat]); // ORS usa [lng, lat]
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: key },
      body: JSON.stringify({ coordinates }),
      signal: controller.signal,
    });
    if (!resp.ok) return null; // 401 (llave mala), 429 (límite), etc. → respaldo interno
    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route?.summary) return null;

    const segments = Array.isArray(route.segments) ? route.segments : [];
    const legs = segments.map((s) => ({ km: Math.round((s.distance / 1000) * 100) / 100 }));
    // Si por alguna razón no vinieron segmentos, igual reportamos el total
    const total_km = Math.round((route.summary.distance / 1000) * 100) / 100;
    return { total_km, metodo: 'ruta', legs: legs.length ? legs : null };
  } catch {
    return null; // timeout / red / formato inesperado → respaldo interno
  } finally {
    clearTimeout(timer);
  }
}

// Punto de entrada: intenta ORS y, si no, usa el cálculo interno.
// points: [{ lat, lng }] en orden de recorrido.
async function estimateRoute(points) {
  const clean = (points || []).filter(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  ).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));

  if (clean.length < 2) return { total_km: 0, metodo: 'interno', legs: [] };

  const ors = await estimateOrs(clean);
  if (ors) {
    // Si ORS no devolvió tramos, completarlos con el interno para conservar el desglose
    if (!ors.legs) ors.legs = estimateInternal(clean).legs;
    return ors;
  }
  return estimateInternal(clean);
}

module.exports = { estimateRoute, haversineKm };
