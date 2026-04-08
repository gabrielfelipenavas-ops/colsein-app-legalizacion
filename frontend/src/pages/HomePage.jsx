import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Camera, FileText, Download, Zap, Clock, Car, Bike, AlertTriangle, Bell, Paperclip, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI } from '../services/api';
import { fmt, fmtNum, dateStr, calcKm, monthName } from '../utils/helpers';

export default function HomePage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    reportAPI.dashboard().then(r => setDashboard(r.data)).catch(() => {});
  }, []);

  const report = dashboard?.current_report;
  const entries = dashboard?.recent_entries || [];
  const totalKm = parseFloat(report?.total_km || 0);
  const valorTotal = parseFloat(report?.valor_total || 0);
  const numVisitas = entries.length;

  return (
    <>
      {/* Stats */}
      <div className="px-4 pt-1 pb-1">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gradient-to-br from-colsein-500 to-colsein-700 rounded-2xl p-4 text-white">
            <p className="text-[10px] opacity-80 font-semibold uppercase tracking-wide">Km este mes</p>
            <p className="text-2xl font-extrabold mt-1 tracking-tight">{fmtNum(totalKm)}</p>
            <p className="text-[11px] opacity-60 mt-0.5">{numVisitas} visitas</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-4 text-white">
            <p className="text-[10px] opacity-80 font-semibold uppercase tracking-wide">Valor a pagar</p>
            <p className="text-xl font-extrabold mt-1 tracking-tight">{fmt(valorTotal)}</p>
            <p className="text-[11px] opacity-60 mt-0.5">{monthName(new Date().getMonth())} {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Zap size={16} className="text-amber-500" /> Acciones Rápidas</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { to: '/km', icon: MapPin, label: 'Registrar Visita', color: 'text-colsein-500 bg-colsein-50' },
            { to: '/facturas', icon: Camera, label: 'Escanear Factura', color: 'text-orange-500 bg-orange-50' },
            { to: '/viajes', icon: FileText, label: 'Solicitar Anticipo', color: 'text-emerald-500 bg-emerald-50' },
            { to: '/reportes', icon: Download, label: 'Generar Excel', color: 'text-amber-600 bg-amber-50' },
          ].map(({ to, icon: Icon, label, color }) => (
            <Link key={to} to={to} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-colsein-300 hover:bg-colsein-50/40 transition-all">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={17} />
              </div>
              <span className="text-xs font-semibold text-slate-800">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Bell size={16} className="text-red-500" /> Alertas</h3>
        <div className="flex gap-2.5 items-start p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">Recuerda entregar tu reporte de kilometraje dentro de los primeros 5 días del mes siguiente.</p>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Clock size={16} className="text-colsein-500" /> Últimas Visitas</h3>
        {entries.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-6">No hay registros recientes</p>
        ) : (
          entries.slice(0, 6).map((e) => {
            const { totalKm: tk, valorKm: vk } = calcKm(e);
            return (
              <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${e.medio === 'CARRO' ? 'bg-colsein-50 text-colsein-500' : 'bg-amber-50 text-amber-600'}`}>
                  {e.medio === 'CARRO' ? <Car size={16} /> : <Bike size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{e.cliente_nombre}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    {dateStr(e.fecha)} · {tk} km
                    {(e.peaje_foto || e.taxi_foto) && <Paperclip size={10} className="text-emerald-500" />}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-colsein-600 font-mono">{fmt(vk)}</p>
                  {parseFloat(e.peajes) > 0 && <p className="text-[10px] text-slate-400">+{fmt(e.peajes)} peaje</p>}
                  {parseFloat(e.taxis) > 0 && <p className="text-[10px] text-orange-500">+{fmt(e.taxis)} taxi</p>}
                </div>
              </div>
            );
          })
        )}
        {entries.length > 0 && (
          <Link to="/km" className="flex items-center justify-center gap-1 text-xs font-semibold text-colsein-500 pt-3 hover:underline">
            Ver todos <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </>
  );
}
