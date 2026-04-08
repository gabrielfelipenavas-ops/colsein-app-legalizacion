import { useState, useEffect } from 'react';
import { Plus, DollarSign, Send, X, Calendar, Clock } from 'lucide-react';
import { anticipoAPI } from '../services/api';
import { fmt, dateStr, PROCESOS, ESTADOS_LABEL, ESTADOS_COLOR } from '../utils/helpers';

function StatusBadge({ status }) {
  const label = ESTADOS_LABEL[status] || status;
  const color = ESTADOS_COLOR[status] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{label}</span>;
}

function AnticipoModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    destino_tipo: 'NACIONAL', motivo: '', proceso: 'Ventas', ciudad_destino: '',
    fecha_ida: '', fecha_regreso: '',
    alojamiento_dia: 0, alimentacion_dia: 80000, transportes_dia: 50000,
    imprevistos_dia: 0, representacion_dia: 0, acepta_terminos: false,
  });
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const duracion = form.fecha_ida && form.fecha_regreso
    ? Math.max(1, Math.ceil((new Date(form.fecha_regreso) - new Date(form.fecha_ida)) / 86400000) + 1) : 0;
  const presupuesto = (form.alojamiento_dia + form.alimentacion_dia + form.transportes_dia + form.imprevistos_dia + form.representacion_dia) * duracion;
  const anticipo = (form.alimentacion_dia + form.transportes_dia) * duracion;
  const canSave = form.motivo && form.ciudad_destino && form.fecha_ida && form.fecha_regreso && form.acepta_terminos;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await anticipoAPI.create({ ...form, acepta_terminos: true });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear anticipo');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[92vh] overflow-auto p-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">Solicitud de Anticipo</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>

        <div className="mb-3.5">
          <label className="label-field">Destino</label>
          <div className="flex gap-2">
            {['NACIONAL', 'INTERNACIONAL'].map(d => (
              <button key={d} onClick={() => u('destino_tipo', d)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${form.destino_tipo === d ? 'bg-colsein-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>{d}</button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <label className="label-field">Motivo del viaje</label>
          <input value={form.motivo} onChange={e => u('motivo', e.target.value)} placeholder="Ej: Visita clientes zona Antioquia" className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          <div>
            <label className="label-field">Proceso</label>
            <select value={form.proceso} onChange={e => u('proceso', e.target.value)} className="input-field">
              {PROCESOS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Ciudad destino</label>
            <input value={form.ciudad_destino} onChange={e => u('ciudad_destino', e.target.value)} placeholder="Ej: Medellín" className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          <div><label className="label-field">Fecha ida</label><input type="date" value={form.fecha_ida} onChange={e => u('fecha_ida', e.target.value)} className="input-field" /></div>
          <div><label className="label-field">Fecha regreso</label><input type="date" value={form.fecha_regreso} onChange={e => u('fecha_regreso', e.target.value)} className="input-field" /></div>
        </div>

        {duracion > 0 && (
          <div className="bg-colsein-50 rounded-xl p-3 mb-4 text-center">
            <span className="text-sm font-bold text-colsein-600">Duración: {duracion} día(s)</span>
          </div>
        )}

        <p className="label-field mb-2">Presupuesto por día</p>
        {[
          { key: 'alojamiento_dia', label: 'Alojamiento', medio: 'TC' },
          { key: 'alimentacion_dia', label: 'Alimentación', medio: 'ANT' },
          { key: 'transportes_dia', label: 'Transportes', medio: 'ANT' },
          { key: 'imprevistos_dia', label: 'Imprevistos', medio: 'ANT' },
          { key: 'representacion_dia', label: 'Gastos Representación', medio: 'TC' },
        ].map(c => (
          <div key={c.key} className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-8 text-center ${c.medio === 'TC' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{c.medio}</span>
            <span className="text-xs font-semibold flex-1">{c.label}</span>
            <input type="number" value={form[c.key] || ''} onChange={e => u(c.key, parseInt(e.target.value) || 0)} className="input-field !w-28 text-right font-mono !text-xs" />
          </div>
        ))}

        {duracion > 0 && (
          <div className="bg-emerald-50 rounded-xl p-3.5 mt-4 mb-4">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-semibold">Presupuesto total</span>
              <span className="text-sm font-extrabold">{fmt(presupuesto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-semibold">Anticipo solicitado</span>
              <span className="text-base font-extrabold text-colsein-600">{fmt(anticipo)}</span>
            </div>
          </div>
        )}

        <label className="flex gap-3 items-start mb-5 cursor-pointer">
          <input type="checkbox" checked={form.acepta_terminos} onChange={e => u('acepta_terminos', e.target.checked)} className="mt-1 w-5 h-5 accent-colsein-500" />
          <span className="text-[11px] text-slate-500 leading-relaxed">
            Este anticipo deberá ser legalizado a los 3 días de mi retorno. De lo contrario, autorizo a la empresa para que sea descontado de mi liquidación.
          </span>
        </label>

        <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary w-full disabled:opacity-50">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
          {saving ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </div>
  );
}

export default function ViajesPage() {
  const [anticipos, setAnticipos] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => { anticipoAPI.list().then(r => setAnticipos(r.data)).catch(() => {}); };
  useEffect(load, []);

  return (
    <>
      <div className="px-4 mb-3">
        <button onClick={() => setShowAdd(true)} className="btn-primary w-full"><Plus size={16} /> Solicitar Anticipo</button>
      </div>

      <div className="card mx-4">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><DollarSign size={16} className="text-emerald-500" /> Solicitudes de Anticipo</h3>
        {anticipos.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No hay anticipos registrados</p>
        ) : (
          anticipos.map(a => (
            <div key={a.id} className="py-3 border-b border-slate-100 last:border-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold">{a.consecutivo} — {a.ciudad_destino}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.motivo}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={11} /> {dateStr(a.fecha_ida)} → {dateStr(a.fecha_regreso)}
                    <span className="mx-1">·</span>
                    <Clock size={11} /> {a.duracion_dias} días
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={a.estado} />
                  <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(a.anticipo_total))}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && <AnticipoModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </>
  );
}
