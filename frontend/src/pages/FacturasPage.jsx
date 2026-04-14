import { useState, useRef, useEffect } from 'react';
import { Camera, FileText, CheckCircle, Edit, PlusCircle, Save, X, Trash2, DollarSign, AlertTriangle, Mail, Search, Link2, ChevronDown, ChevronUp, Download, Unlink, ExternalLink, Eye, Image as ImageIcon } from 'lucide-react';
import { expenseAPI, emailAPI } from '../services/api';
import { fmt } from '../utils/helpers';

const CATEGORIAS = [
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'alojamiento', label: 'Alojamiento' },
  { value: 'transportes', label: 'Transportes' },
  { value: 'imprevistos', label: 'Imprevistos' },
  { value: 'representacion', label: 'Gastos de Representación' },
  { value: 'peaje', label: 'Peaje' },
  { value: 'parqueadero', label: 'Parqueadero' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'otro', label: 'Otro' },
];

const CAT_LABELS = Object.fromEntries(CATEGORIAS.map(c => [c.value, c.label]));

const MEDIOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
];

const emptyForm = {
  categoria: 'alimentacion',
  fecha: new Date().toISOString().split('T')[0],
  establecimiento: '',
  nit_establecimiento: '',
  direccion: '',
  valor: '',
  iva: '',
  propina: '',
  medio_pago: 'efectivo',
  numero_factura: '',
  cufe: '',
  observaciones: '',
  sin_soporte: false,
  justificacion_sin_soporte: '',
};

function EmailSearchSection({ expenses, onMatchSaved }) {
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState(null);
  const [emailResults, setEmailResults] = useState(null);
  const [savedMatches, setSavedMatches] = useState([]);
  const [error, setError] = useState('');
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [linkingExpenseId, setLinkingExpenseId] = useState(null);
  const [savingMatch, setSavingMatch] = useState(false);

  useEffect(() => { loadSavedMatches(); }, []);

  const loadSavedMatches = async () => {
    try {
      const { data } = await emailAPI.getMatches();
      setSavedMatches(data);
    } catch {}
  };

  const autoMatch = async () => {
    setSearching(true);
    setError('');
    try {
      const { data } = await emailAPI.match();
      setMatches(data);
      setEmailResults(null);
      if (data.auto_saved > 0) {
        loadSavedMatches();
        onMatchSaved?.();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar en el correo');
    }
    setSearching(false);
  };

  const searchRecent = async () => {
    setSearching(true);
    setError('');
    try {
      const { data } = await emailAPI.search({ limit: 20 });
      setEmailResults(data);
      setMatches(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar en el correo');
    }
    setSearching(false);
  };

  const handleManualLink = async (email) => {
    if (!linkingExpenseId) return;
    setSavingMatch(true);
    try {
      await emailAPI.saveMatch({
        expense_id: linkingExpenseId,
        email_uid: email.id,
        email_subject: email.subject,
        email_from: email.from,
        email_date: email.date,
        nit_extracted: email.extracted?.nit || null,
        valor_extracted: email.extracted?.valor || null,
        numero_factura: email.extracted?.numero_factura || null,
        attachments: email.attachments || [],
        match_type: 'manual',
        confidence: 0,
      });
      setLinkingExpenseId(null);
      loadSavedMatches();
      onMatchSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al vincular');
    }
    setSavingMatch(false);
  };

  const handleUnlink = async (matchId) => {
    if (!confirm('¿Desvincular esta factura electrónica del gasto?')) return;
    try {
      await emailAPI.deleteMatch(matchId);
      loadSavedMatches();
      onMatchSaved?.();
    } catch {}
  };

  const downloadAttachment = async (uid, filename) => {
    try {
      const { data } = await emailAPI.downloadAttachment(uid, filename);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al descargar adjunto');
    }
  };

  const matchedExpenseIds = new Set(savedMatches.map(m => m.expense_id));
  const unmatchedExpenses = expenses.filter(e => !matchedExpenseIds.has(e.id));

  return (
    <div className="card mx-4 mt-3">
      <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Mail size={16} className="text-violet-500" /> Facturas Electrónicas (Correo)</h3>
      <p className="text-xs text-slate-400 mb-3">Busca facturas electrónicas en el correo y vinculalas con tus gastos.</p>

      <div className="flex gap-2 mb-3">
        <button onClick={autoMatch} disabled={searching || expenses.length === 0} className="btn-primary flex-1 !bg-violet-500 hover:!bg-violet-600 !py-2 !text-xs disabled:opacity-50">
          {searching ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link2 size={14} />}
          {searching ? 'Buscando...' : 'Cruzar automático'}
        </button>
        <button onClick={searchRecent} disabled={searching} className="btn-outline flex-1 !py-2 !text-xs disabled:opacity-50">
          <Search size={14} /> Ver correos
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3">
          <p className="text-xs font-semibold text-red-600">{error}</p>
        </div>
      )}

      {/* Saved matches summary */}
      {savedMatches.length > 0 && (
        <div className="mb-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mb-2">
            <p className="text-xs font-semibold text-emerald-700">
              <CheckCircle size={12} className="inline mr-1" />
              {savedMatches.length} factura(s) electrónica(s) vinculada(s)
            </p>
          </div>
          <div className="space-y-1.5">
            {savedMatches.map(m => (
              <div key={m.id} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{m.Expense?.establecimiento || 'Gasto #' + m.expense_id}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.email_subject}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{m.match_type === 'auto' ? 'Auto' : 'Manual'}</span>
                    {m.confidence > 0 && <span className="text-[9px] text-emerald-600">{m.confidence}%</span>}
                  </div>
                </div>
                <button onClick={() => handleUnlink(m.id)} className="text-red-400 hover:text-red-600 p-1 ml-2" title="Desvincular">
                  <Unlink size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual linking mode */}
      {linkingExpenseId && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-amber-700">
              <Link2 size={12} className="inline mr-1" />
              Selecciona un correo para vincular con el gasto
            </p>
            <button onClick={() => setLinkingExpenseId(null)} className="text-amber-500"><X size={16} /></button>
          </div>
          <p className="text-[10px] text-amber-600">
            Gasto: {expenses.find(e => e.id === linkingExpenseId)?.establecimiento || '#' + linkingExpenseId}
            {' · '}
            {fmt(expenses.find(e => e.id === linkingExpenseId)?.valor || 0)}
          </p>
          {!emailResults && (
            <button onClick={searchRecent} disabled={searching} className="btn-primary w-full mt-2 !py-2 !text-xs !bg-amber-500 hover:!bg-amber-600">
              <Search size={14} /> Buscar correos para vincular
            </button>
          )}
        </div>
      )}

      {/* Auto-match results */}
      {matches && (
        <div className="space-y-2 mb-3">
          <div className="bg-violet-50 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-violet-700">
              {matches.matches.length} coincidencia(s) de {matches.total_expenses} gastos y {matches.total_emails} correos
              {matches.auto_saved > 0 && <span className="text-emerald-600 ml-1">· {matches.auto_saved} guardada(s) automáticamente</span>}
            </p>
          </div>
          {matches.matches.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No se encontraron coincidencias. Usa "Ver correos" para vincular manualmente.</p>
          )}
          {matches.matches.map((m, i) => (
            <div key={i} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle size={12} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700">
                  Coincidencia ({m.confidence}%)
                  {m.confidence >= 50 && <span className="ml-1 text-emerald-500">· Guardada</span>}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="font-bold text-slate-700">{m.expense.establecimiento || 'Sin nombre'}</p>
                  <p className="text-slate-400">{m.expense.fecha} · {fmt(parseFloat(m.expense.valor))}</p>
                </div>
                <div>
                  <p className="font-bold text-violet-700 truncate">{m.email.subject}</p>
                  <p className="text-slate-400 truncate">{m.email.from}</p>
                </div>
              </div>
              {m.confidence < 50 && !matchedExpenseIds.has(m.expense_id) && (
                <button onClick={() => emailAPI.saveMatch({
                  expense_id: m.expense_id,
                  email_uid: String(m.email.uid),
                  email_subject: m.email.subject,
                  email_from: m.email.from,
                  email_date: m.email.date,
                  nit_extracted: m.email.nit,
                  valor_extracted: m.email.valor,
                  attachments: [],
                  match_type: 'manual',
                  confidence: m.confidence,
                }).then(() => { loadSavedMatches(); onMatchSaved?.(); })}
                  className="mt-2 text-[10px] font-bold text-violet-600 underline">
                  Confirmar y guardar este cruce
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Email results list — expandable */}
      {emailResults && (
        <div className="space-y-2">
          <div className="bg-slate-100 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-slate-600">{emailResults.length} correo(s) con facturas</p>
          </div>
          {emailResults.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No se encontraron facturas recientes.</p>}
          {emailResults.map((email, i) => {
            const isExpanded = expandedEmail === i;
            return (
              <div key={i} className={`rounded-xl border transition-all ${linkingExpenseId ? 'border-amber-200 hover:border-amber-400 cursor-pointer' : 'border-slate-200'}`}>
                <div
                  className={`p-2.5 ${linkingExpenseId ? 'hover:bg-amber-50' : 'hover:bg-slate-50'} rounded-xl`}
                  onClick={() => linkingExpenseId ? null : setExpandedEmail(isExpanded ? null : i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {email.hasXml && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">XML</span>}
                      {email.hasPdf && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">PDF</span>}
                      <span className="text-[10px] text-slate-400 shrink-0">{new Date(email.date).toLocaleDateString('es-CO')}</span>
                    </div>
                    {!linkingExpenseId && (
                      isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-700 truncate mt-1">{email.subject}</p>
                  <p className="text-[10px] text-slate-400 truncate">{email.from}</p>
                  {email.extracted?.nit && <span className="text-[10px] text-violet-600 mr-2">NIT: {email.extracted.nit}</span>}
                  {email.extracted?.valor && <span className="text-[10px] text-emerald-600">Valor: {fmt(email.extracted.valor)}</span>}

                  {/* Manual linking button */}
                  {linkingExpenseId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleManualLink(email); }}
                      disabled={savingMatch}
                      className="mt-2 btn-primary w-full !py-2 !text-xs !bg-amber-500 hover:!bg-amber-600 disabled:opacity-50"
                    >
                      {savingMatch ? 'Vinculando...' : <><Link2 size={12} /> Vincular con este correo</>}
                    </button>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && !linkingExpenseId && (
                  <div className="px-2.5 pb-2.5 border-t border-slate-100 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">De:</span>
                        <span className="text-slate-700 font-semibold truncate ml-2">{email.from}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Fecha:</span>
                        <span className="text-slate-700 font-semibold">{new Date(email.date).toLocaleString('es-CO')}</span>
                      </div>
                      {email.extracted?.numero_factura && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">No. Factura:</span>
                          <span className="text-slate-700 font-semibold">{email.extracted.numero_factura}</span>
                        </div>
                      )}
                      {email.extracted?.cufe && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">CUFE:</span>
                          <span className="text-slate-700 font-semibold text-[9px] truncate ml-2">{email.extracted.cufe}</span>
                        </div>
                      )}
                    </div>

                    {/* Attachments */}
                    {email.attachments?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-1">Adjuntos:</p>
                        {email.attachments.map((att, j) => (
                          <button key={j} onClick={() => downloadAttachment(email.id, att.filename)}
                            className="flex items-center gap-2 w-full p-1.5 bg-blue-50 rounded-lg mb-1 hover:bg-blue-100 transition-colors text-left">
                            <Download size={12} className="text-blue-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-blue-700 truncate">{att.filename}</span>
                            <span className="text-[9px] text-blue-400 shrink-0">{att.size ? Math.round(att.size / 1024) + 'KB' : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick link buttons on unmatched expenses */}
      {unmatchedExpenses.length > 0 && !linkingExpenseId && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 mb-2">Gastos sin factura electrónica ({unmatchedExpenses.length}):</p>
          <div className="space-y-1">
            {unmatchedExpenses.slice(0, 5).map(exp => (
              <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{exp.establecimiento || 'Sin nombre'}</p>
                  <p className="text-[10px] text-slate-400">{exp.fecha} · {fmt(exp.valor)}</p>
                </div>
                <button onClick={() => { setLinkingExpenseId(exp.id); if (!emailResults) searchRecent(); }}
                  className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg hover:bg-violet-100 shrink-0 ml-2">
                  <Link2 size={10} className="inline mr-0.5" /> Vincular
                </button>
              </div>
            ))}
            {unmatchedExpenses.length > 5 && (
              <p className="text-[10px] text-slate-400 text-center">y {unmatchedExpenses.length - 5} más...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseDetailModal({ expense, onClose, onSaved, initialEdit = false }) {
  const [editing, setEditing] = useState(initialEdit);
  const [form, setForm] = useState({
    categoria: expense.categoria || 'otro',
    fecha: expense.fecha || '',
    establecimiento: expense.establecimiento || '',
    nit_establecimiento: expense.nit_establecimiento || '',
    direccion: expense.direccion || '',
    valor: expense.valor || '',
    iva: expense.iva || '',
    medio_pago: expense.medio_pago || 'efectivo',
    numero_factura: expense.numero_factura || '',
    cufe: expense.cufe || '',
    observaciones: expense.observaciones || '',
  });
  const [newFile, setNewFile] = useState(null);
  const [newPreview, setNewPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isPdf = expense.imagen_url?.toLowerCase().endsWith('.pdf');
  const imageSrc = expense.imagen_url ? (expense.imagen_url.startsWith('/') ? expense.imagen_url : `/${expense.imagen_url}`) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      if (newFile) fd.append('imagen', newFile);
      await expenseAPI.update(expense.id, fd);
      onSaved?.();
      onClose();
    } catch (err) {
      alert('Error al actualizar: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            {editing ? <><Edit size={16} className="text-colsein-500" /> Editar gasto</> : <><Eye size={16} className="text-colsein-500" /> Detalle del gasto</>}
          </h3>
          <button onClick={onClose} className="text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Imagen */}
          {(newPreview || imageSrc) && !isPdf && (
            <div className="bg-slate-100 rounded-xl overflow-hidden">
              <img src={newPreview || imageSrc} alt="Soporte" className="w-full max-h-80 object-contain" onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
          {isPdf && !newFile && (
            <a href={imageSrc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100">
              <FileText size={20} className="text-blue-500" />
              <span className="text-sm font-semibold text-blue-700">Abrir PDF del soporte</span>
              <ExternalLink size={14} className="text-blue-500 ml-auto" />
            </a>
          )}
          {!imageSrc && !newPreview && !isPdf && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-700">Sin imagen de soporte</span>
            </div>
          )}

          {/* Cambiar imagen al editar */}
          {editing && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Reemplazar soporte (opcional)</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  setNewFile(f);
                  if (f.type.startsWith('image/')) setNewPreview(URL.createObjectURL(f));
                  else setNewPreview(null);
                }
              }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white" />
              {newFile && (
                <p className="text-[10px] text-emerald-600 mt-1">Nuevo: {newFile.name}</p>
              )}
            </div>
          )}

          {/* Campos */}
          {editing ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Categoría</label>
                <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Establecimiento</label>
                <input type="text" value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">NIT</label>
                  <input type="text" value={form.nit_establecimiento} onChange={e => set('nit_establecimiento', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">No. Factura</label>
                  <input type="text" value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Dirección</label>
                <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor</label>
                  <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">IVA</label>
                  <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Medio de Pago</label>
                <div className="flex gap-1.5">
                  {MEDIOS_PAGO.map(m => (
                    <button key={m.value} onClick={() => set('medio_pago', m.value)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold border ${form.medio_pago === m.value ? 'bg-colsein-500 text-white border-colsein-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">CUFE</label>
                <input type="text" value={form.cufe} onChange={e => set('cufe', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {[
                ['Categoría', CAT_LABELS[expense.categoria] || expense.categoria],
                ['Fecha', expense.fecha],
                ['Establecimiento', expense.establecimiento || '—'],
                ['NIT', expense.nit_establecimiento || '—'],
                ['Dirección', expense.direccion || '—'],
                ['No. Factura', expense.numero_factura || '—'],
                ['Valor', fmt(expense.valor)],
                ['IVA', fmt(expense.iva)],
                ['Medio de Pago', MEDIOS_PAGO.find(m => m.value === expense.medio_pago)?.label || expense.medio_pago],
                ['CUFE', expense.cufe || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">{label}</span>
                  <span className="text-xs font-semibold text-slate-700 text-right max-w-[60%] break-words">{value}</span>
                </div>
              ))}
              {expense.observaciones && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-400 mb-1">Observaciones</p>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{expense.observaciones}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-outline flex-1 !py-2.5 !text-xs">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 !py-2.5 !text-xs">
                {saving ? 'Guardando...' : <><Save size={14} /> Guardar</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-outline flex-1 !py-2.5 !text-xs">Cerrar</button>
              <button onClick={() => setEditing(true)} className="btn-primary flex-1 !py-2.5 !text-xs"><Edit size={14} /> Editar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FacturasPage() {
  const fileRef = useRef(null);
  const manualFileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [validationError, setValidationError] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [openInEdit, setOpenInEdit] = useState(false);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const { data } = await expenseAPI.list();
      setExpenses(data);
    } catch {}
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type === 'application/pdf') {
      setPreview(null); // Can't preview PDFs inline
    } else {
      setPreview(URL.createObjectURL(f));
    }
    setProcessing(true);
    setResult(null);
    setShowManual(false);
    setSaved(false);
    setValidationError('');

    // Only OCR for images, not PDFs
    if (f.type.startsWith('image/')) {
      try {
        const { data } = await expenseAPI.ocr(f);
        setResult(data.ocr_data);
        fillFromOCR(data.ocr_data, false);
      } catch {
        setResult({ error: 'No se pudo procesar. Ingresa datos manualmente.' });
      }
    } else {
      // PDF — go straight to manual form
      setResult(null);
      setShowManual(true);
    }
    setProcessing(false);
  };

  const fillFromOCR = (ocrData, openForm = true) => {
    const catMap = {
      'Alimentación': 'alimentacion',
      'Alojamiento': 'alojamiento',
      'Transportes': 'transportes',
      'Imprevistos': 'imprevistos',
      'Gastos de Representación': 'representacion',
    };
    setForm({
      ...emptyForm,
      categoria: catMap[ocrData.tipo_gasto] || 'otro',
      fecha: ocrData.fecha || emptyForm.fecha,
      establecimiento: ocrData.establecimiento || '',
      nit_establecimiento: ocrData.nit || '',
      direccion: ocrData.direccion || '',
      valor: ocrData.valor_total ? String(ocrData.valor_total) : '',
      iva: ocrData.iva ? String(ocrData.iva) : '',
      medio_pago: ocrData.medio_pago === 'Tarjeta Débito' ? 'tarjeta_debito' : ocrData.medio_pago === 'Tarjeta Crédito' ? 'tarjeta_credito' : 'efectivo',
      numero_factura: ocrData.numero_factura || '',
      cufe: ocrData.cufe || '',
    });
    if (openForm) setShowManual(true);
  };

  const valorNeto = () => {
    const val = parseFloat(form.valor) || 0;
    const propina = parseFloat(form.propina) || 0;
    return Math.max(0, val - propina);
  };

  const validate = () => {
    if (!form.valor || parseFloat(form.valor) <= 0) return 'Ingresa el valor del gasto';
    if (!file && !form.sin_soporte) return 'Debes adjuntar foto/PDF de la factura o marcar "Sin soporte" y justificar';
    if (form.sin_soporte && !form.justificacion_sin_soporte.trim()) return 'Debes justificar por qué no tienes el soporte';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError('');
    setSaving(true);
    try {
      const fd = new FormData();
      // Send valor neto (minus propina) as the actual expense value
      const propina = parseFloat(form.propina) || 0;
      const entries = Object.entries(form);
      entries.forEach(([k, v]) => {
        if (k === 'sin_soporte') return;
        if (k === 'valor' && propina > 0) {
          fd.append('valor', String(valorNeto()));
          return;
        }
        if (k === 'propina') return; // stored in observaciones
        if (k === 'justificacion_sin_soporte') return;
        if (v) fd.append(k, v);
      });

      // Add propina and justification info to observaciones
      let obs = form.observaciones || '';
      if (propina > 0) obs = `[Propina/Servicio: $${propina}] ${obs}`.trim();
      if (form.sin_soporte) obs = `[SIN SOPORTE: ${form.justificacion_sin_soporte}] ${obs}`.trim();
      if (obs) fd.append('observaciones', obs);

      if (file) fd.append('imagen', file);
      await expenseAPI.create(fd);
      setSaved(true);
      setShowManual(false);
      setResult(null);
      setPreview(null);
      setFile(null);
      setForm(emptyForm);
      loadExpenses();
    } catch (err) {
      alert('Error al guardar el gasto');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await expenseAPI.delete(id);
      loadExpenses();
    } catch {}
  };

  const openManual = () => {
    setForm(emptyForm);
    setShowManual(true);
    setResult(null);
    setPreview(null);
    setFile(null);
    setSaved(false);
    setValidationError('');
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <>
      {saved && (
        <div className="mx-4 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700">Gasto guardado correctamente</span>
        </div>
      )}

      <div className="card mx-4">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Camera size={16} className="text-orange-500" /> Registro de Facturas y Gastos</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">Escanea una factura (foto o PDF) o ingresa los datos manualmente.</p>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-primary flex-1 !bg-amber-500 hover:!bg-amber-600">
            <Camera size={18} /> Escanear
          </button>
          <button onClick={openManual} className="btn-outline flex-1">
            <PlusCircle size={18} /> Manual
          </button>
        </div>
      </div>

      {preview && !showManual && (
        <div className="card mx-4 mt-3">
          <img src={preview} alt="Preview" className="w-full rounded-xl max-h-48 object-cover mb-3" />
          {processing && (
            <div className="text-center py-4">
              <div className="w-10 h-10 border-3 border-slate-200 border-t-colsein-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-colsein-600">Procesando con IA...</p>
              <p className="text-xs text-slate-400 mt-1">Extrayendo datos de la factura</p>
            </div>
          )}
          {result && !result.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-600 mb-2"><CheckCircle size={16} /> Datos Extraídos</p>
              {Object.entries(result).filter(([,v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-emerald-100 last:border-0">
                  <span className="text-[10px] font-semibold uppercase text-emerald-700">{k.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-semibold text-slate-800">{String(v)}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowManual(true)} className="btn-primary flex-1 !py-2 !text-xs"><Save size={14} /> Revisar y Guardar</button>
                <button onClick={() => { setPreview(null); setResult(null); setFile(null); }} className="btn-outline flex-1 !py-2 !text-xs"><Edit size={14} /> Reintentar</button>
              </div>
            </div>
          )}
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-600 mb-2">{result.error}</p>
              <button onClick={() => { setShowManual(true); setResult(null); }} className="btn-primary w-full !py-2 !text-xs !bg-red-500 hover:!bg-red-600">
                <Edit size={14} /> Ingresar Manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {/* PDF uploaded without preview */}
      {file && !preview && !showManual && !processing && (
        <div className="card mx-4 mt-3">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <FileText size={24} className="text-blue-500" />
            <div>
              <p className="text-sm font-bold text-blue-700">{file.name}</p>
              <p className="text-xs text-blue-500">PDF cargado correctamente</p>
            </div>
          </div>
          <button onClick={() => setShowManual(true)} className="btn-primary w-full mt-3 !py-2 !text-xs">
            <Edit size={14} /> Ingresar datos de la factura
          </button>
        </div>
      )}

      {showManual && (
        <div className="card mx-4 mt-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Edit size={16} className="text-colsein-500" /> {result && !result.error ? 'Verificar y Guardar' : 'Registro Manual'}</h3>
            <button onClick={() => { setShowManual(false); if (!result) { setPreview(null); setFile(null); } }} className="text-slate-400"><X size={18} /></button>
          </div>

          {result && !result.error && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-3">
              <p className="text-xs font-semibold text-blue-600">Los datos fueron pre-llenados del escaneo. Verifica y corrige si es necesario.</p>
            </div>
          )}

          {preview && (
            <img src={preview} alt="Preview" className="w-full rounded-xl max-h-32 object-cover mb-3" />
          )}

          {file && !preview && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl mb-3">
              <FileText size={16} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">{file.name}</span>
            </div>
          )}

          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs font-semibold text-red-600">{validationError}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Categoría *</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold bg-white">
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Establecimiento</label>
              <input type="text" value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)} placeholder="Nombre del establecimiento" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">NIT</label>
                <input type="text" value={form.nit_establecimiento} onChange={e => set('nit_establecimiento', e.target.value)} placeholder="NIT" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">No. Factura</label>
                <input type="text" value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} placeholder="Número" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Dirección</label>
              <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Dirección del establecimiento" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Total Factura *</label>
                <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="$0" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">IVA</label>
                <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} placeholder="$0" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

            {/* Propina/Servicio — solo para alimentación */}
            {form.categoria === 'alimentacion' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-amber-700">Servicio / Propina (se descuenta del total)</label>
                </div>
                <input type="number" value={form.propina} onChange={e => set('propina', e.target.value)} placeholder="$0"
                  className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white" />
                {(parseFloat(form.propina) || 0) > 0 && (parseFloat(form.valor) || 0) > 0 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-amber-200">
                    <span className="text-xs font-semibold text-amber-700">Valor neto (sin propina)</span>
                    <span className="text-sm font-extrabold text-amber-800">{fmt(valorNeto())}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Medio de Pago</label>
              <div className="flex gap-1.5">
                {MEDIOS_PAGO.map(m => (
                  <button key={m.value} onClick={() => set('medio_pago', m.value)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${form.medio_pago === m.value ? 'bg-colsein-500 text-white border-colsein-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">CUFE</label>
              <input type="text" value={form.cufe} onChange={e => set('cufe', e.target.value)} placeholder="Código CUFE (opcional)" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Notas adicionales (opcional)" rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
            </div>

            {/* Soporte de factura — OBLIGATORIO */}
            <div className={`rounded-xl p-3 ${file ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <label className="text-xs font-semibold mb-2 block ${file ? 'text-emerald-700' : 'text-red-700'}">
                {file ? '✓ Soporte adjunto' : 'Foto o PDF de la factura *'}
              </label>

              {!file && (
                <>
                  <input ref={manualFileRef} type="file" accept="image/*,application/pdf" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
                    }
                  }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white mb-2" />

                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={form.sin_soporte} onChange={e => set('sin_soporte', e.target.checked)} className="w-4 h-4 accent-red-500" />
                    <span className="text-xs font-semibold text-red-600">No tengo el soporte</span>
                  </label>

                  {form.sin_soporte && (
                    <div className="mt-2">
                      <label className="text-xs font-semibold text-red-700 mb-1 block">Justificación *</label>
                      <textarea value={form.justificacion_sin_soporte} onChange={e => set('justificacion_sin_soporte', e.target.value)}
                        placeholder="Explica por qué no tienes la factura..." rows={2}
                        className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                  )}
                </>
              )}

              {file && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-700 truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <button onClick={() => { setFile(null); setPreview(null); }} className="text-xs text-red-500 font-semibold">Quitar</button>
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full !py-3">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</> : <><Save size={18} /> Guardar Gasto</>}
            </button>
          </div>
        </div>
      )}

      {/* Lista de gastos guardados */}
      {expenses.length > 0 && (
        <div className="card mx-4 mt-3">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><DollarSign size={16} className="text-emerald-500" /> Gastos Registrados ({expenses.length})</h3>
          <div className="space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  {exp.imagen_url && !exp.imagen_url.toLowerCase().endsWith('.pdf') ? (
                    <img src={exp.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200" onError={e => { e.target.style.display = 'none'; }} />
                  ) : exp.imagen_url ? (
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><FileText size={16} className="text-blue-500" /></div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-amber-500" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-colsein-600">{CAT_LABELS[exp.categoria] || exp.categoria}</span>
                      <span className="text-[10px] text-slate-400">{exp.fecha}</span>
                      {exp.observaciones?.includes('[SIN SOPORTE') && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Sin soporte</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-semibold truncate">{exp.establecimiento || 'Sin establecimiento'}</p>
                    <p className="text-sm font-extrabold text-slate-800">{fmt(exp.valor)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedExpense(exp); setOpenInEdit(false); }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors">
                    <Eye size={12} /> Ver
                  </button>
                  <button
                    onClick={() => { setSelectedExpense(exp); setOpenInEdit(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
                    <Edit size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="px-3 py-2 rounded-lg bg-white border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                    title="Eliminar">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscar facturas en correo */}
      <EmailSearchSection expenses={expenses} onMatchSaved={loadExpenses} />

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          initialEdit={openInEdit}
          onClose={() => { setSelectedExpense(null); setOpenInEdit(false); }}
          onSaved={loadExpenses}
        />
      )}

      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><FileText size={16} className="text-colsein-500" /> Documentos Soportados</h3>
        {['🧾 Tiquetes de peaje', '🅿️ Recibos de parqueadero', '🚕 Recibos de taxi / apps', '🍽️ Facturas de restaurantes', '🏨 Facturas de hotel', '📄 PDFs de facturas electrónicas'].map((t, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xl">{t.split(' ')[0]}</span>
            <span className="text-sm font-semibold">{t.split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
      </div>
    </>
  );
}
