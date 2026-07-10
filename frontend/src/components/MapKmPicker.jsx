import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Undo2, Check, Navigation } from 'lucide-react';
import { tripAPI } from '../services/api';
import { fmtNum } from '../utils/helpers';
import useModalA11y from '../utils/useModalA11y';

// Selector de ruta en el mapa: el usuario toca origen → destino (y paradas
// intermedias si quiere) y se estima el kilometraje aproximado (gratis).
export default function MapKmPicker({ onClose, onPick }) {
  const modalRef = useModalA11y(onClose);
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [puntos, setPuntos] = useState([]);
  const [est, setEst] = useState(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current).setView([4.65, -74.08], 12); // Bogotá por defecto
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e) => setPuntos((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]));
    // Centrar en la ubicación del usuario si la concede
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
        () => {}, { enableHighAccuracy: true, timeout: 8000 }
      );
    }
    mapRef.current = map;
    [100, 350, 700, 1200].forEach((t) => setTimeout(() => { try { map.invalidateSize(); } catch {} }, t));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Al marcar puntos, calcular AUTOMÁTICAMENTE la ruta por calles (con un pequeño
  // retraso para no saturar). Así la línea por las vías aparece sola.
  useEffect(() => {
    setEst(null);
    if (puntos.length < 2) { setEstimating(false); return; }
    setEstimating(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await tripAPI.estimate(puntos);
        setEst(data);
      } catch { /* si falla, queda la línea recta punteada de referencia */ }
      setEstimating(false);
    }, 500);
    return () => clearTimeout(t);
  }, [puntos]);

  // Redibujar marcadores y la ruta (por calles si ya se estimó; si no, recta punteada)
  useEffect(() => {
    const layer = layerRef.current, map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const coords = puntos.map((p) => [p.lat, p.lng]);
    const ruta = est?.geometry;
    const tieneRuta = Array.isArray(ruta) && ruta.length >= 2;
    if (tieneRuta) {
      L.polyline(ruta, { color: '#0ea5e9', weight: 5, opacity: 0.85 }).addTo(layer);
    } else if (coords.length >= 2) {
      L.polyline(coords, { color: '#0ea5e9', weight: 4, opacity: 0.6, dashArray: '6' }).addTo(layer);
    }
    puntos.forEach((p, i) => {
      const color = i === 0 ? '#16a34a' : i === puntos.length - 1 ? '#dc2626' : '#0ea5e9';
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(i === 0 ? 'Origen' : i === puntos.length - 1 ? 'Destino' : `Parada ${i}`, { permanent: false })
        .addTo(layer);
    });
    // Centrar el mapa en la ruta (o en los puntos) para que se vea bien
    const fitCoords = tieneRuta ? ruta : coords;
    if (fitCoords.length >= 2) {
      try { map.invalidateSize(); map.fitBounds(L.latLngBounds(fitCoords), { padding: [25, 25], maxZoom: 16 }); } catch {}
    }
  }, [puntos, est]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[400] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Estimar kilómetros en el mapa" className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[94vh] overflow-auto p-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold flex items-center gap-2"><Navigation size={18} className="text-colsein-500" /> Estimar km en el mapa</h2>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">Toca en el mapa el <strong>origen</strong>, luego el <strong>destino</strong> (y paradas intermedias si las hubo). La <strong>ruta por las calles</strong> y los km se calculan solos.</p>

        <div ref={elRef} className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 mb-2" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">{puntos.length} punto(s) marcado(s)</span>
          <div className="flex gap-2">
            {puntos.length > 0 && (
              <button onClick={() => setPuntos(p => p.slice(0, -1))} className="text-[11px] font-bold text-slate-600 flex items-center gap-1"><Undo2 size={12} /> Deshacer</button>
            )}
            {puntos.length > 0 && (
              <button onClick={() => setPuntos([])} className="text-[11px] font-bold text-red-500">Limpiar</button>
            )}
          </div>
        </div>

        {est && (
          <div className="bg-colsein-50 rounded-xl p-3 mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-colsein-600 font-semibold uppercase">Distancia estimada</p>
              <p className="text-2xl font-extrabold text-colsein-600">{fmtNum(parseFloat(est.total_km))} km</p>
              <p className="text-[10px] text-slate-400">{est.metodo === 'ruta' ? 'Por carretera real' : 'Estimado interno (aprox.)'}</p>
            </div>
            <MapPin size={26} className="text-colsein-300" />
          </div>
        )}

        {puntos.length < 2 ? (
          <button disabled className="btn-primary w-full !py-3 opacity-50">Marca origen y destino en el mapa</button>
        ) : estimating ? (
          <button disabled className="btn-primary w-full !py-3 opacity-70">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Calculando ruta por las calles…
          </button>
        ) : est ? (
          <button onClick={() => { onPick(parseFloat(est.total_km)); onClose(); }} className="btn-primary w-full !py-3 !bg-emerald-500 hover:!bg-emerald-600">
            <Check size={16} /> Usar estos {fmtNum(parseFloat(est.total_km))} km
          </button>
        ) : (
          <button onClick={() => setPuntos(p => [...p])} className="btn-outline w-full !py-3">
            No se pudo calcular la ruta — toca para reintentar
          </button>
        )}
      </div>
    </div>
  );
}
