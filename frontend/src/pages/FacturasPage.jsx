import { useState, useRef, useEffect } from 'react';
import { Camera, FileText, CheckCircle, Edit, PlusCircle, Save, X, Trash2, DollarSign, AlertTriangle, Mail, Search, Link2 } from 'lucide-react';
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

function EmailSearchSection({ expenses }) {
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState(null);
  const [emailResults, setEmailResults] = useState(null);
  const [error, setError] = useState('');

  const autoMatch = async () => {
    setSearching(true);
    setError('');
    try {
      const { data } = await emailAPI.match();
      setMatches(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar en el correo');
    }
    setSearching(false);
  };

  const searchRecent = async () => {
    setSearching(true);
    setError('');
    try {
      const { data } = await emailAPI.search({ limit: 15 });
      setEmailResults(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar en el correo');
    }
    setSearching(false);
  };

  return (
    <div className="card mx-4 mt-3">
      <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Mail size={16} className="text-violet-500" /> Facturas Electrónicas (Correo)</h3>
      <p className="text-xs text-slate-400 mb-3">Busca facturas electrónicas en el correo centralizado y relaciónolas con tus gastos.</p>

      <div className="flex gap-2 mb-3">
        <button onClick={autoMatch} disabled={searching || expenses.length === 0} className="btn-primary flex-1 !bg-violet-500 hover:!bg-violet-600 !py-2 !text-xs disabled:opacity-50">
          {searching ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link2 size={14} />}
          {searching ? 'Buscando...' : 'Cruzar con mis gastos'}
        </button>
        <button onClick={searchRecent} disabled={searching} className="btn-outline flex-1 !py-2 !text-xs disabled:opacity-50">
          <Search size={14} /> Ver recientes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3">
          <p className="text-xs font-semibold text-red-600">{error}</p>
        </div>
      )}

      {matches && (
        <div className="space-y-2">
          <div className="bg-violet-50 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-violet-700">
              {matches.matches.length} coincidencia(s) encontrada(s) de {matches.total_expenses} gastos y {matches.total_emails} correos
            </p>
          </div>
          {matches.matches.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No se encontraron coincidencias. Las facturas electrónicas pueden tardar en llegar al correo.</p>
          )}
          {matches.matches.map((m, i) => (
            <div key={i} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle size={12} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700">Coincidencia ({m.confidence}%)</span>
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
            </div>
          ))}
        </div>
      )}

      {emailResults && !matches && (
        <div className="space-y-2">
          {emailResults.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No se encontraron facturas recientes en el correo.</p>}
          {emailResults.map((email, i) => (
            <div key={i} className="p-2.5 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2">
                {email.hasXml && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">XML</span>}
                {email.hasPdf && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">PDF</span>}
                <span className="text-[10px] text-slate-400">{new Date(email.date).toLocaleDateString('es-CO')}</span>
              </div>
              <p className="text-xs font-bold text-slate-700 truncate mt-1">{email.subject}</p>
              <p className="text-[10px] text-slate-400 truncate">{email.from}</p>
              {email.extracted?.nit && <p className="text-[10px] text-violet-600 mt-0.5">NIT: {email.extracted.nit}</p>}
              {email.extracted?.valor && <p className="text-[10px] text-emerald-600">Valor: {fmt(email.extracted.valor)}</p>}
            </div>
          ))}
        </div>
      )}
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
              <div key={exp.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-colsein-600">{CAT_LABELS[exp.categoria] || exp.categoria}</span>
                    <span className="text-[10px] text-slate-400">{exp.fecha}</span>
                    {exp.observaciones?.includes('[SIN SOPORTE') && <AlertTriangle size={12} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{exp.establecimiento || 'Sin establecimiento'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{fmt(exp.valor)}</span>
                  <button onClick={() => handleDelete(exp.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscar facturas en correo */}
      <EmailSearchSection expenses={expenses} />

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
