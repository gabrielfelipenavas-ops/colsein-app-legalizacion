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
  return { total_km: Math.round(total * 100) / 100, metodo: 'interno', legs, geometry: null };
}

// Cálculo por carretera real con OSRM (servidor público de OpenStreetMap).
// GRATIS y SIN LLAVE. Una sola petición que pasa por todos los puntos en orden.
async function estimateOsrm(points) {
  if (points.length < 2) return null;
  // OSRM usa "lng,lat" separados por ";". Pedimos la geometría (las calles) en GeoJSON.
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'colsein-app' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;
    const route = data.routes[0];
    const legs = (route.legs || []).map((l) => ({ km: Math.round((l.distance / 1000) * 100) / 100 }));
    const total_km = Math.round((route.distance / 1000) * 100) / 100;
    if (!(total_km > 0)) return null;
    // Geometría: GeoJSON viene como [lng, lat]; lo pasamos a [lat, lng] para Leaflet
    const coordsGeo = route.geometry?.coordinates || [];
    const geometry = coordsGeo.map((c) => [c[1], c[0]]);
    return { total_km, metodo: 'ruta', legs: legs.length ? legs : null, geometry: geometry.length ? geometry : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Cálculo por carretera real con OpenRouteService (alternativa, requiere ORS_API_KEY).
async function estimateOrs(points) {
  const key = process.env.ORS_API_KEY;
  if (!key || points.length < 2) return null;

  const coordinates = points.map((p) => [p.lng, p.lat]); // ORS usa [lng, lat]
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
        Authorization: key,
      },
      body: JSON.stringify({ coordinates }),
      signal: controller.signal,
    });
    if (!resp.ok) return null; // 401 (llave mala), 429 (límite), etc. → siguiente opción
    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route?.summary) return null;

    const segments = Array.isArray(route.segments) ? route.segments : [];
    const legs = segments.map((s) => ({ km: Math.round((s.distance / 1000) * 100) / 100 }));
    const total_km = Math.round((route.summary.distance / 1000) * 100) / 100;
    if (!(total_km > 0)) return null;
    return { total_km, metodo: 'ruta', legs: legs.length ? legs : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Punto de entrada: ruteo REAL por carretera (OSRM, luego ORS) y, si ninguno
// responde, respaldo interno por línea recta × factor. points: [{lat,lng}] en orden.
async function estimateRoute(points) {
  const clean = (points || []).filter(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  ).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));

  if (clean.length < 2) return { total_km: 0, metodo: 'interno', legs: [] };

  // 1) OSRM (gratis, sin llave) → 2) ORS (si hay llave) → 3) interno
  const real = (await estimateOsrm(clean)) || (await estimateOrs(clean));
  if (real) {
    if (!real.legs) real.legs = estimateInternal(clean).legs; // conservar el desglose por tramo
    return real;
  }
  return estimateInternal(clean);
}

module.exports = { estimateRoute, haversineKm };
