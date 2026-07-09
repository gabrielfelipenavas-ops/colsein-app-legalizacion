import { useState, useEffect } from 'react';
import { Plus, FileText, DollarSign, Send, X, Download, CheckCircle, Shield, Calendar, Clock, Edit, Save, Unlock } from 'lucide-react';
import { legalizationAPI, expenseAPI, anticipoAPI, reportAPI, authorizationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useModalA11y from '../utils/useModalA11y';
import { fmt, dateStr, ESTADOS_LABEL, ESTADOS_COLOR } from '../utils/helpers';

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

function NuevaLegalizacionModal({ onClose, onSaved }) {
  const modalRef = useModalA11y(onClose);
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('local'); // local | viaje
  const [moneda, setMoneda] = useState('COP');
  const [ciudades, setCiudades] = useState('');
  const [motivo, setMotivo] = useState('');
  const [anticipos, setAnticipos] = useState([]);
  const [selectedAnticipo, setSelectedAnticipo] = useState(null);
  const [allExpenses, setAllExpenses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [legalization, setLegalization] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    anticipoAPI.list().then(r => setAnticipos(r.data.filter(a => ['aprobado', 'anticipo_girado'].includes(a.estado)))).catch(() => {});
    expenseAPI.list().then(r => setAllExpenses(r.data)).catch(() => {});
  }, []);

  // Solo se ofrecen gastos SIN legalizar (los que ya pertenecen a otra
  // legalización no se pueden volver a incluir) — el mensaje de vacío lo explica.
  const unlinkedExpenses = allExpenses.filter(e => !e.legalization_id);
  const yaLegalizados = allExpenses.length - unlinkedExpenses.length;
  const toggleExpense = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const totalSelected = unlinkedExpenses.filter(e => selectedIds.includes(e.id)).reduce((s, e) => s + parseFloat(e.valor || 0), 0);

  // Validación del paso "Información": no se puede avanzar sin ciudad(es) ni,
  // para gastos locales, sin el motivo.
  const faltaMotivo = tipo === 'local' && !motivo.trim();
  const faltaCiudad = !ciudades.trim();
  const infoValida = !faltaMotivo && !faltaCiudad;

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { data: leg } = await legalizationAPI.create({
        travel_request_id: tipo === 'viaje' ? selectedAnticipo?.id || null : null,
        ciudades_visitadas: ciudades,
        moneda,
        tipo,
        motivo,
      });
      setLegalization(leg);

      if (selectedIds.length > 0) {
        const { data: updated } = await legalizationAPI.updateExpenses(leg.id, selectedIds);
        setLegalization(updated);
      }
      setStep(4);
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

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Nueva legalización" className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[92vh] overflow-auto p-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">
            {step === 1 && 'Nueva Legalización'}
            {step === 2 && 'Información'}
            {step === 3 && 'Seleccionar Gastos'}
            {step === 4 && 'Resumen'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>

        {/* Step 1: Type selection */}
        {step === 1 && (
          <>
            <p className="text-xs text-slate-400 mb-4">¿Qué tipo de gastos vas a legalizar?</p>
            <div className="space-y-3">
              <button onClick={() => { setTipo('local'); setStep(2); }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-colsein-500 transition-all">
                <p className="text-sm font-bold">Gasto Local</p>
                <p className="text-xs text-slate-400 mt-1">Gastos en la ciudad donde vives (alimentación, transportes, reuniones, etc.)</p>
              </button>
              <button onClick={() => { setTipo('viaje'); setStep(2); }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-colsein-500 transition-all">
                <p className="text-sm font-bold">Viaje</p>
                <p className="text-xs text-slate-400 mt-1">Gastos relacionados a un viaje (con o sin anticipo)</p>
              </button>
            </div>
          </>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <>
            {tipo === 'viaje' && anticipos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Vincular a anticipo (opcional)</p>
                {anticipos.map(a => (
                  <button key={a.id} onClick={() => setSelectedAnticipo(selectedAnticipo?.id === a.id ? null : a)}
                    className={`w-full text-left p-3 rounded-xl mb-2 border transition-all ${selectedAnticipo?.id === a.id ? 'border-colsein-500 bg-colsein-50' : 'border-slate-200'}`}>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold">{a.consecutivo} — {a.ciudad_destino}</span>
                      <span className="text-sm font-bold text-colsein-600">{fmt(parseFloat(a.anticipo_total))}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{dateStr(a.fecha_ida)} → {dateStr(a.fecha_regreso)}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {tipo === 'local' && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Motivo</label>
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Reunión con cliente, gastos de oficina"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Ciudad(es)</label>
                <input value={ciudades} onChange={e => setCiudades(e.target.value)} placeholder="Ej: Pereira, Armenia"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Moneda</label>
                <div className="flex gap-2">
                  {[{ v: 'COP', l: 'COP ($)' }, { v: 'USD', l: 'USD ($)' }, { v: 'EUR', l: 'EUR (€)' }].map(m => (
                    <button key={m.v} onClick={() => setMoneda(m.v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${moneda === m.v ? 'bg-colsein-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!infoValida && (
              <p className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                {faltaCiudad && faltaMotivo ? 'Completa el motivo y la(s) ciudad(es) para continuar.'
                  : faltaCiudad ? 'Indica la(s) ciudad(es) para continuar.'
                  : 'Indica el motivo del gasto para continuar.'}
              </p>
            )}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Atrás</button>
              <button onClick={() => setStep(3)} disabled={!infoValida} className="btn-primary flex-1 disabled:opacity-50">Siguiente</button>
            </div>
          </>
        )}

        {/* Step 3: Select expenses */}
        {step === 3 && (
          <>
            {unlinkedExpenses.length === 0 ? (
              <div className="text-center py-8">
                {yaLegalizados > 0 ? (
                  <>
                    <p className="text-sm text-slate-400">No hay gastos sin legalizar disponibles.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tienes {yaLegalizados} gasto{yaLegalizados === 1 ? '' : 's'} registrado{yaLegalizados === 1 ? '' : 's'}, pero ya {yaLegalizados === 1 ? 'está vinculado' : 'están vinculados'} a otra legalización.
                      Registra nuevos gastos en la pestaña Facturas para incluirlos aquí.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">No hay gastos disponibles.</p>
                    <p className="text-xs text-slate-400 mt-1">Registra gastos en la pestaña Facturas primero.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">Selecciona los gastos para esta legalización. Asegúrate de que cada gasto tenga la categoría correcta.</p>
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
                      <span className="text-xs font-semibold">{selectedIds.length} gasto(s)</span>
                      <span className="text-sm font-extrabold text-colsein-600">{fmt(totalSelected)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(2)} className="btn-outline flex-1">Atrás</button>
              <button onClick={handleCreate} disabled={selectedIds.length === 0 || saving} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear Legalización'}
              </button>
            </div>
          </>
        )}

        {/* Step 4: Summary */}
        {step === 4 && legalization && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-600 mb-3"><CheckCircle size={16} /> Legalización Creada</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Tipo</span>
                  <span className="text-xs font-bold">{tipo === 'local' ? 'Gasto Local' : 'Viaje'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Gastos</span>
                  <span className="text-xs font-bold">{legalization.expenses?.length || selectedIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Total gastos</span>
                  <span className="text-sm font-bold">{fmt(parseFloat(legalization.gasto_real_total || totalSelected))}</span>
                </div>
                {parseFloat(legalization.valor_anticipo || 0) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Anticipo</span>
                      <span className="text-xs font-bold">{fmt(parseFloat(legalization.valor_anticipo))}</span>
                    </div>
                    {parseFloat(legalization.pago_favor_empresa || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-500">Debe devolver</span>
                        <span className="text-xs font-bold text-red-600">{fmt(parseFloat(legalization.pago_favor_empresa))}</span>
                      </div>
                    )}
                    {parseFloat(legalization.pago_favor_empleado || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-500">Le deben reembolsar</span>
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

function EditarLegalizacionModal({ legalization, onClose, onSaved }) {
  const modalRef = useModalA11y(onClose);
  let extra = {};
  try { extra = JSON.parse(legalization.observaciones_imprevistos || '{}'); } catch {}

  const [tipo, setTipo] = useState(extra.tipo || 'local');
  const [motivo, setMotivo] = useState(extra.motivo || '');
  const [ciudades, setCiudades] = useState(legalization.ciudades_visitadas || '');
  const [moneda, setMoneda] = useState(legalization.moneda || 'COP');
  const [valorAnticipo, setValorAnticipo] = useState(legalization.valor_anticipo || 0);
  const [allExpenses, setAllExpenses] = useState([]);
  const [selectedIds, setSelectedIds] = useState((legalization.expenses || []).map(e => e.id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    expenseAPI.list().then(r => setAllExpenses(r.data)).catch(() => {});
  }, []);

  const availableExpenses = allExpenses.filter(e =>
    e.legalization_id === legalization.id || !e.legalization_id
  );

  const totalSelected = availableExpenses
    .filter(e => selectedIds.includes(e.id))
    .reduce((s, e) => s + parseFloat(e.valor || 0), 0);

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await legalizationAPI.update(legalization.id, {
        ciudades_visitadas: ciudades,
        moneda,
        tipo,
        motivo,
        valor_anticipo: parseFloat(valorAnticipo) || 0,
      });
      await legalizationAPI.updateExpenses(legalization.id, selectedIds);
      onSaved?.();
      onClose();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div
        ref={modalRef} role="dialog" aria-modal="true" aria-label={`Editar legalización ${legalization.id}`}
        className="fixed inset-0 z-[70] bg-white flex flex-col sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:max-h-[90vh] sm:rounded-3xl sm:shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Edit size={16} className="text-colsein-500" /> Editar Legalización #{legalization.id}</h3>
          <button onClick={onClose} className="text-slate-400 p-1"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
            <div className="flex gap-1.5">
              {[{ v: 'local', l: 'Local' }, { v: 'viaje', l: 'Viaje' }].map(t => (
                <button key={t.v} onClick={() => setTipo(t.v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border ${tipo === t.v ? 'bg-colsein-500 text-white border-colsein-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          {tipo === 'local' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Motivo</label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Ciudades Visitadas</label>
            <input type="text" value={ciudades} onChange={e => setCiudades(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Anticipo</label>
              <input type="number" value={valorAnticipo} onChange={e => setValorAnticipo(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
          </div>

          {/* Gastos asociados */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Gastos asociados ({selectedIds.length})</label>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
              {availableExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">No hay gastos disponibles</p>
              ) : availableExpenses.map(e => (
                <label key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} className="w-4 h-4 accent-colsein-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{CAT_LABELS[e.categoria] || e.categoria} — {e.establecimiento || 'Sin nombre'}</p>
                    <p className="text-[10px] text-slate-400">{e.fecha}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{fmt(e.valor)}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-right">Total seleccionado: <span className="font-bold text-colsein-600">{fmt(totalSelected)}</span></p>
          </div>
        </div>

        <div className="shrink-0 bg-white border-t border-slate-100 p-4 flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="btn-outline flex-1 !py-3 !text-xs">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 !py-3 !text-xs !bg-emerald-500 hover:!bg-emerald-600">
            {saving ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </>
  );
}

export default function LegalizacionPage() {
  const { user } = useAuth();
  const [legalizations, setLegalizations] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [editingLeg, setEditingLeg] = useState(null);

  const [submittingId, setSubmittingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = () => { legalizationAPI.list().then(r => setLegalizations(r.data)).catch(() => {}); };
  useEffect(load, []);

  const submitLeg = async (leg) => {
    if (submittingId) return;
    if (!confirm(`¿Enviar la Legalización #${leg.id} para aprobación? Después de enviarla no podrás modificarla sin autorización de gerencia/presidencia.`)) return;
    setSubmittingId(leg.id);
    try {
      await legalizationAPI.submit(leg.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
    }
    setSubmittingId(null);
  };

  const solicitarModificacion = async (leg) => {
    const motivo = prompt('¿Por qué necesitas modificar esta legalización? (obligatorio)');
    if (!motivo || !motivo.trim()) return;
    try {
      const { data } = await authorizationAPI.request({
        tipo: 'modificacion',
        concepto: `Modificar Legalización #${leg.id}`,
        detalle: motivo.trim(),
        ref_tipo: 'legalizacion',
        ref_id: leg.id,
      });
      if (data.estado === 'autorizado') {
        alert('Legalización desbloqueada: ya puedes modificarla.');
      } else {
        alert('Solicitud enviada. Cuando gerencia o presidencia la autorice, la legalización volverá a borrador para que puedas editarla.');
      }
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo crear la solicitud de modificación');
    }
  };

  const downloadLeg = async (legId) => {
    if (downloadingId) return;
    setDownloadingId(`excel-${legId}`);
    try {
      const { data } = await reportAPI.downloadLegalizacionExcel(legId);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Legalizacion_${legId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar'); }
    setDownloadingId(null);
  };

  const downloadFacturas = async (legId) => {
    if (downloadingId) return;
    setDownloadingId(`zip-${legId}`);
    try {
      const { data } = await reportAPI.downloadLegalizacionFacturas(legId);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facturas_Legalizacion_${legId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar las facturas'); }
    setDownloadingId(null);
  };

  return (
    <>
      <div className="px-4 mb-3">
        <button onClick={() => setShowNew(true)} className="btn-primary w-full"><Plus size={16} /> Nueva Legalización</button>
      </div>

      <div className="card mx-4">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Shield size={16} className="text-amber-600" /> Legalizaciones</h3>
        {legalizations.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No hay legalizaciones. Crea una nueva para empezar.</p>
        ) : (
          legalizations.map(leg => {
            let extra = {};
            try { extra = JSON.parse(leg.observaciones_imprevistos || '{}'); } catch {}
            return (
              <div key={leg.id} className="py-3 border-b border-slate-100 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">Legalización #{leg.id}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${extra.tipo === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {extra.tipo === 'local' ? 'Local' : 'Viaje'}
                      </span>
                    </div>
                    {leg.User?.nombre && <p className="text-[11px] text-slate-500 font-semibold">{leg.User.nombre}</p>}
                    {leg.TravelRequest && <p className="text-xs text-slate-400">{leg.TravelRequest.consecutivo} — {leg.TravelRequest.ciudad_destino}</p>}
                    {leg.ciudades_visitadas && <p className="text-xs text-slate-400">{leg.ciudades_visitadas}</p>}
                    <p className="text-xs text-slate-400">{leg.expenses?.length || 0} gasto(s) · {leg.moneda || 'COP'}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={leg.estado} />
                    <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(leg.gasto_real_total || 0))}</p>
                    <div className="flex items-center gap-2 justify-end mt-1 flex-wrap">
                      {['borrador', 'rechazado'].includes(leg.estado) && leg.user_id === user?.id && (
                        <>
                          <button onClick={() => setEditingLeg(leg)} className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                            <Edit size={11} /> Editar
                          </button>
                          <button onClick={() => submitLeg(leg)} disabled={submittingId === leg.id} className="text-[10px] text-white bg-colsein-500 hover:bg-colsein-600 rounded-lg px-2 py-1 font-semibold flex items-center gap-1 disabled:opacity-50">
                            <Send size={11} /> {submittingId === leg.id ? 'Enviando…' : 'Enviar'}
                          </button>
                        </>
                      )}
                      {['enviado', 'revisado', 'aprobado'].includes(leg.estado) && leg.user_id === user?.id && (
                        <button onClick={() => solicitarModificacion(leg)} className="text-[10px] text-violet-600 font-semibold flex items-center gap-1">
                          <Unlock size={11} /> Solicitar modificación
                        </button>
                      )}
                      <button onClick={() => downloadLeg(leg.id)} disabled={!!downloadingId} className="text-[10px] text-colsein-500 font-semibold flex items-center gap-1 disabled:opacity-50">
                        <Download size={11} /> {downloadingId === `excel-${leg.id}` ? 'Generando…' : 'Excel'}
                      </button>
                      <button onClick={() => downloadFacturas(leg.id)} disabled={!!downloadingId} className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 disabled:opacity-50">
                        <Download size={11} /> {downloadingId === `zip-${leg.id}` ? 'Generando…' : 'Facturas'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showNew && <NuevaLegalizacionModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {editingLeg && <EditarLegalizacionModal legalization={editingLeg} onClose={() => setEditingLeg(null)} onSaved={() => { setEditingLeg(null); load(); }} />}
    </>
  );
}
