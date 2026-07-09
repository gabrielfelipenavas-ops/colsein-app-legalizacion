import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Car, Bike, MapPin, Navigation, Flag, CheckCircle, Trash2, Undo2, AlertTriangle, Home } from 'lucide-react';
import { tripAPI } from '../services/api';
import { fmt, fmtNum, hoyLocal, TARIFAS } from '../utils/helpers';
import useModalA11y from '../utils/useModalA11y';

// Obtiene la ubicación actual del dispositivo (GPS del navegador). Gratis.
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu dispositivo o navegador no permite ubicación GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg = err.code === 1
          ? 'Permiso de ubicación denegado. Actívalo en el navegador para registrar tu posición.'
          : 'No se pudo obtener tu ubicación. Verifica que el GPS esté activo e intenta de nuevo.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ── Mapa (Leaflet + OpenStreetMap, sin costo ni llave) ──
function RutaMapa({ puntos, ruta }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { attributionControl: true }).setView([4.65, -74.08], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Recalcular tamaño varias veces (el modal puede no estar dimensionado al inicio)
    [100, 350, 700, 1200].forEach((t) => setTimeout(() => { try { map.invalidateSize(); } catch {} }, t));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const coords = (puntos || []).filter(p => p.lat != null && p.lng != null).map(p => [p.lat, p.lng]);
    if (coords.length === 0) return;

    // Dibujar la ruta por calles si la tenemos; si no, línea recta entre puntos
    const tieneRuta = Array.isArray(ruta) && ruta.length >= 2;
    if (tieneRuta) {
      L.polyline(ruta, { color: '#0ea5e9', weight: 5, opacity: 0.85 }).addTo(layer);
    } else if (coords.length >= 2) {
      L.polyline(coords, { color: '#0ea5e9', weight: 4, opacity: 0.6, dashArray: '6' }).addTo(layer);
    }
    puntos.forEach((p, i) => {
      const color = p.tipo === 'salida' ? '#16a34a' : p.tipo === 'regreso' ? '#dc2626' : '#0ea5e9';
      L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(`${i === 0 ? 'Salida' : p.tipo === 'regreso' ? 'Regreso' : (i + '. ' + (p.label || 'Visita'))}`, { permanent: false })
        .addTo(layer);
    });
    map.invalidateSize();
    const boundsCoords = (Array.isArray(ruta) && ruta.length >= 2) ? ruta : coords;
    map.fitBounds(L.latLngBounds(boundsCoords), { padding: [30, 30], maxZoom: 16 });
  }, [puntos, ruta]);

  return <div ref={elRef} className="w-full h-56 rounded-xl overflow-hidden border border-slate-200" />;
}

export default function RecorridoModal({ onClose, onSaved, initialTrip }) {
  const modalRef = useModalA11y(onClose);
  const [medio, setMedio] = useState(initialTrip?.medio || 'CARRO');
  const [trip, setTrip] = useState(initialTrip || null);
  const [visitName, setVisitName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [totalConfirm, setTotalConfirm] = useState(
    initialTrip?.estado === 'finalizado' ? String(parseFloat(initialTrip.total_km_estimado || 0)) : ''
  );

  const puntos = trip?.puntos || [];
  const estimado = parseFloat(trip?.total_km_estimado || 0);
  const tarifa = medio === 'CARRO' ? TARIFAS.CARRO : TARIFAS.MOTO;
  const finalizado = trip?.estado === 'finalizado';
  const numVisitas = puntos.filter(p => p.tipo === 'visita').length;

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); }
    catch (err) { setError(err.response?.data?.error || err.message || 'Ocurrió un error'); }
    finally { setBusy(false); }
  };

  const iniciar = () => run(async () => {
    const pos = await getPosition();
    const { data } = await tripAPI.start({ medio, fecha: hoyLocal(), punto: { ...pos, label: 'Salida', tipo: 'salida' } });
    setTrip(data);
  });

  const registrarLlegada = () => run(async () => {
    if (!visitName.trim()) { setError('Escribe el nombre del cliente/lugar de la visita.'); return; }
    const pos = await getPosition();
    const { data } = await tripAPI.addPoint(trip.id, { ...pos, label: visitName.trim(), tipo: 'visita' });
    setTrip(data);
    setVisitName('');
  });

  const finalizar = () => run(async () => {
    const pos = await getPosition();
    const { data } = await tripAPI.finish(trip.id, { ...pos, label: 'Regreso', tipo: 'regreso' });
    setTrip(data);
    setTotalConfirm(String(parseFloat(data.total_km_estimado || 0)));
  });

  const deshacer = () => run(async () => {
    const { data } = await tripAPI.undoLast(trip.id);
    setTrip(data);
  });

  const confirmar = () => run(async () => {
    const total = parseFloat(totalConfirm);
    if (Number.isNaN(total) || total < 0) { setError('Ingresa un total de kilómetros válido.'); return; }
    await tripAPI.confirm(trip.id, total);
    onSaved?.();
    onClose();
  });

  const cancelar = () => run(async () => {
    if (trip && trip.estado !== 'confirmado') { try { await tripAPI.remove(trip.id); } catch {} }
    onClose();
  });

  const totalNum = parseFloat(totalConfirm) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Recorrido GPS" className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[94vh] overflow-auto p-5 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold flex items-center gap-2"><Navigation size={20} className="text-colsein-500" /> Recorrido con GPS</h2>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* PASO 0 — elegir medio e iniciar */}
        {!trip && (
          <>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Registra tu ubicación al <strong>salir</strong>, al <strong>llegar a cada visita</strong> y al <strong>regresar</strong>.
              La app estima los kilómetros y tú los confirmas antes de que cuenten para el reporte.
            </p>
            <label className="label-field">Medio de transporte</label>
            <div className="flex gap-2 mb-4">
              {['CARRO', 'MOTO'].map(m => (
                <button key={m} onClick={() => setMedio(m)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${medio === m ? 'bg-colsein-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                  {m === 'CARRO' ? <Car size={16} /> : <Bike size={16} />} {m}
                </button>
              ))}
            </div>
            <button onClick={iniciar} disabled={busy} className="btn-primary w-full !py-3 !bg-emerald-500 hover:!bg-emerald-600">
              {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <MapPin size={18} />}
              {busy ? 'Obteniendo ubicación...' : 'Iniciar recorrido (registrar salida)'}
            </button>
          </>
        )}

        {/* PASOS 1+ — recorrido en curso o finalizado */}
        {trip && (
          <>
            <RutaMapa puntos={puntos} ruta={trip?.ruta} />

            {/* Lista de paradas */}
            <div className="mt-3 space-y-1.5">
              {puntos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${p.tipo === 'salida' ? 'bg-emerald-500' : p.tipo === 'regreso' ? 'bg-red-500' : 'bg-colsein-500'}`}>
                    {p.tipo === 'salida' ? <Home size={12} /> : p.tipo === 'regreso' ? <Flag size={12} /> : i}
                  </span>
                  <span className="font-semibold text-slate-700 flex-1 truncate">
                    {p.tipo === 'salida' ? 'Salida' : p.tipo === 'regreso' ? 'Regreso (casa/oficina)' : p.label}
                  </span>
                  {trip.legs?.[i - 1] && i > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">{fmtNum(parseFloat(trip.legs[i - 1].km))} km</span>
                  )}
                </div>
              ))}
            </div>

            {/* Estimación */}
            {puntos.length >= 2 && (
              <div className="mt-3 bg-colsein-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-colsein-600 font-semibold uppercase">Estimación del programa</p>
                  <p className="text-2xl font-extrabold text-colsein-600">{fmtNum(estimado)} km</p>
                  <p className="text-[10px] text-slate-400">
                    {trip.metodo === 'ruta' ? 'Calculado por carretera real' : 'Estimado interno (aprox.)'} · {fmt(estimado * tarifa)}
                  </p>
                </div>
                <Navigation size={28} className="text-colsein-300" />
              </div>
            )}

            {/* Acciones durante el recorrido */}
            {!finalizado && (
              <div className="mt-4 space-y-2">
                <label className="label-field">Nombre del cliente / lugar de la visita</label>
                <input value={visitName} onChange={e => setVisitName(e.target.value)} placeholder="Ej: Hitachi Pereira" className="input-field" />
                <button onClick={registrarLlegada} disabled={busy} className="btn-primary w-full !py-3">
                  {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <MapPin size={18} />}
                  {busy ? 'Registrando...' : 'Registrar llegada a esta visita'}
                </button>
                <div className="flex gap-2">
                  {puntos.length > 1 && (
                    <button onClick={deshacer} disabled={busy} className="btn-outline flex-1 !py-2.5 !text-xs"><Undo2 size={14} /> Deshacer última</button>
                  )}
                  <button onClick={finalizar} disabled={busy} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1">
                    <Flag size={14} /> Finalizar (registrar regreso)
                  </button>
                </div>
              </div>
            )}

            {/* Confirmación final */}
            {finalizado && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><CheckCircle size={14} /> Confirma los kilómetros del recorrido</p>
                <p className="text-[11px] text-slate-500 mb-2">Puedes ajustar el total si lo ves necesario. Al confirmar, se agrega a tu reporte de kilometraje del mes.</p>
                <label className="label-field">Kilómetros recorridos</label>
                <input type="number" value={totalConfirm} onChange={e => setTotalConfirm(e.target.value)} className="input-field font-mono mb-1" />
                <p className="text-[11px] text-slate-400 mb-2">📍 Estimado por GPS: <strong className="text-colsein-600">{fmtNum(estimado)} km</strong> · puedes ajustarlo arriba</p>
                <div className="flex justify-between text-xs mb-3 px-1">
                  <span className="text-slate-500">Valor a pagar ({numVisitas} visita{numVisitas !== 1 ? 's' : ''})</span>
                  <span className="font-bold text-colsein-600">{fmt(totalNum * tarifa)}</span>
                </div>
                <button onClick={confirmar} disabled={busy} className="btn-primary w-full !py-3 !bg-emerald-500 hover:!bg-emerald-600">
                  {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={18} />}
                  {busy ? 'Confirmando...' : 'Confirmar y agregar al reporte'}
                </button>
              </div>
            )}

            <button onClick={cancelar} disabled={busy} className="w-full mt-3 text-xs font-semibold text-red-500 flex items-center justify-center gap-1 py-2">
              <Trash2 size={13} /> Cancelar y descartar este recorrido
            </button>
          </>
        )}
      </div>
    </div>
  );
}
