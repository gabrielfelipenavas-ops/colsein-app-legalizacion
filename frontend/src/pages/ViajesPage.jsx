import { useState, useEffect } from 'react';
import { Plus, FileText, DollarSign, Send, Check, X, Shield, Calendar, Clock, Download, CheckCircle } from 'lucide-react';
import { anticipoAPI, legalizationAPI, expenseAPI, reportAPI } from '../services/api';
import { fmt, dateStr, PROCESOS, ESTADOS_LABEL, ESTADOS_COLOR } from '../utils/helpers';

function StatusBadge({ status }) {
  const label = ESTADOS_LABEL[status] || status;
  const color = ESTADOS_COLOR[status] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{label}</span>;
}

const CAT_LABELS = {
  alimentacion: 'Alimentación', alojamiento: 'Alojamiento', transportes: 'Transportes',
  imprevistos: 'Imprevistos', representacion: 'G. Representación', peaje: 'Peaje',
  parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro',
};

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

function LegalizarModal({ onClose, onSaved, anticipos }) {
  const [step, setStep] = useState(1); // 1: select anticipo, 2: select expenses, 3: summary
  const [selectedAnticipo, setSelectedAnticipo] = useState(null);
  const [ciudades, setCiudades] = useState('');
  const [allExpenses, setAllExpenses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [legalization, setLegalization] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const aprobados = anticipos.filter(a => ['aprobado', 'anticipo_girado'].includes(a.estado));

  useEffect(() => {
    expenseAPI.list().then(r => setAllExpenses(r.data)).catch(() => {});
  }, []);

  const unlinkedExpenses = allExpenses.filter(e => !e.legalization_id);

  const toggleExpense = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { data: leg } = await legalizationAPI.create({
        travel_request_id: selectedAnticipo?.id || null,
        ciudades_visitadas: ciudades,
      });
      setLegalization(leg);

      if (selectedIds.length > 0) {
        const { data: updated } = await legalizationAPI.updateExpenses(leg.id, selectedIds);
        setLegalization(updated);
      }

      setStep(3);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear legalización');
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!legalization) return;
    setSaving(true);
    try {
      await legalizationAPI.submit(legalization.id);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
    }
    setSaving(false);
  };

  const handleDownload = async () => {
    if (!legalization) return;
    setDownloading(true);
    try {
      const { data } = await reportAPI.downloadLegalizacionExcel(legalization.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Legalizacion_Gastos_${legalization.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar'); }
    setDownloading(false);
  };

  const totalSelected = unlinkedExpenses.filter(e => selectedIds.includes(e.id)).reduce((s, e) => s + parseFloat(e.valor || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[92vh] overflow-auto p-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">
            {step === 1 && 'Legalización de Gastos'}
            {step === 2 && 'Seleccionar Gastos'}
            {step === 3 && 'Resumen'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>

        {step === 1 && (
          <>
            {aprobados.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-500 mb-2">Vincular a anticipo (opcional)</p>
                {aprobados.map(a => (
                  <button key={a.id} onClick={() => setSelectedAnticipo(selectedAnticipo?.id === a.id ? null : a)}
                    className={`w-full text-left p-3 rounded-xl mb-2 border transition-all ${selectedAnticipo?.id === a.id ? 'border-colsein-500 bg-colsein-50' : 'border-slate-200'}`}>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold">{a.consecutivo} — {a.ciudad_destino}</span>
                      <span className="text-sm font-bold text-colsein-600">{fmt(parseFloat(a.anticipo_total))}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{dateStr(a.fecha_ida)} → {dateStr(a.fecha_regreso)}</p>
                  </button>
                ))}
              </>
            )}

            <div className="mt-3 mb-4">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Ciudades visitadas</label>
              <input value={ciudades} onChange={e => setCiudades(e.target.value)} placeholder="Ej: Pereira, Armenia, Manizales"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <button onClick={() => setStep(2)} className="btn-primary w-full">
              Siguiente — Seleccionar Gastos
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {unlinkedExpenses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No hay gastos disponibles.</p>
                <p className="text-xs text-slate-400 mt-1">Registra gastos en la pestaña Facturas primero.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">Selecciona los gastos que quieres incluir en esta legalización.</p>
                <div className="space-y-2 max-h-[50vh] overflow-auto">
                  {unlinkedExpenses.map(exp => (
                    <button key={exp.id} onClick={() => toggleExpense(exp.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedIds.includes(exp.id) ? 'border-colsein-500 bg-colsein-50' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs font-bold text-colsein-600">{CAT_LABELS[exp.categoria] || exp.categoria}</span>
                          <span className="text-[10px] text-slate-400 ml-2">{dateStr(exp.fecha)}</span>
                          <p className="text-xs text-slate-500 truncate">{exp.establecimiento || 'Sin establecimiento'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{fmt(parseFloat(exp.valor))}</span>
                          {selectedIds.includes(exp.id) && <CheckCircle size={18} className="text-colsein-500" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedIds.length > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold">{selectedIds.length} gasto(s) seleccionado(s)</span>
                      <span className="text-sm font-extrabold text-colsein-600">{fmt(totalSelected)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Atrás</button>
              <button onClick={handleCreate} disabled={selectedIds.length === 0 || saving} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear Legalización'}
              </button>
            </div>
          </>
        )}

        {step === 3 && legalization && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-600 mb-3"><CheckCircle size={16} /> Legalización Creada</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Gastos registrados</span>
                  <span className="text-xs font-bold">{legalization.expenses?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Gasto real total</span>
                  <span className="text-sm font-bold">{fmt(parseFloat(legalization.gasto_real_total || 0))}</span>
                </div>
                {parseFloat(legalization.valor_anticipo || 0) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Valor anticipo</span>
                      <span className="text-xs font-bold">{fmt(parseFloat(legalization.valor_anticipo))}</span>
                    </div>
                    {parseFloat(legalization.pago_favor_empresa || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-500">A favor de la empresa</span>
                        <span className="text-xs font-bold text-red-600">{fmt(parseFloat(legalization.pago_favor_empresa))}</span>
                      </div>
                    )}
                    {parseFloat(legalization.pago_favor_empleado || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-500">A favor del empleado</span>
                        <span className="text-xs font-bold text-emerald-600">{fmt(parseFloat(legalization.pago_favor_empleado))}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <button onClick={handleDownload} disabled={downloading} className="btn-outline w-full">
                <Download size={16} /> {downloading ? 'Descargando...' : 'Descargar Excel'}
              </button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full">
                <Send size={16} /> {saving ? 'Enviando...' : 'Enviar para Aprobación'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ViajesPage() {
  const [anticipos, setAnticipos] = useState([]);
  const [legalizations, setLegalizations] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showLegalizar, setShowLegalizar] = useState(false);

  const load = () => {
    anticipoAPI.list().then(r => setAnticipos(r.data)).catch(() => {});
    legalizationAPI.list().then(r => setLegalizations(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const downloadLeg = async (legId) => {
    try {
      const { data } = await reportAPI.downloadLegalizacionExcel(legId);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Legalizacion_${legId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar'); }
  };

  return (
    <>
      <div className="px-4 flex gap-2 mb-3">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex-1"><Plus size={16} /> Solicitar Anticipo</button>
        <button onClick={() => setShowLegalizar(true)} className="btn-outline flex-1"><FileText size={16} /> Legalizar</button>
      </div>

      {/* Anticipos List */}
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

      {/* Legalizations List */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Shield size={16} className="text-amber-600" /> Legalizaciones</h3>
        {legalizations.length === 0 ? (
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-center text-xs text-slate-400 py-4">No hay legalizaciones. Presiona "Legalizar" para crear una.</p>
          </div>
        ) : (
          legalizations.map(leg => (
            <div key={leg.id} className="py-3 border-b border-slate-100 last:border-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold">
                    Legalización #{leg.id}
                    {leg.TravelRequest && <span className="text-xs text-slate-400 ml-1">({leg.TravelRequest.consecutivo})</span>}
                  </p>
                  {leg.ciudades_visitadas && <p className="text-xs text-slate-400 mt-0.5">{leg.ciudades_visitadas}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{leg.expenses?.length || 0} gasto(s)</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={leg.estado} />
                  <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(leg.gasto_real_total || 0))}</p>
                  <button onClick={() => downloadLeg(leg.id)} className="text-[10px] text-colsein-500 font-semibold mt-1 flex items-center gap-1 ml-auto">
                    <Download size={11} /> Excel
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && <AnticipoModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {showLegalizar && <LegalizarModal onClose={() => setShowLegalizar(false)} onSaved={() => { setShowLegalizar(false); load(); }} anticipos={anticipos} />}
    </>
  );
}
