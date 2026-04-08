import { useState, useRef, useEffect } from 'react';
import { Camera, FileText, CheckCircle, Edit, PlusCircle, Save, X, Trash2, DollarSign } from 'lucide-react';
import { expenseAPI } from '../services/api';
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
  medio_pago: 'efectivo',
  numero_factura: '',
  cufe: '',
  observaciones: '',
};

export default function FacturasPage() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expenses, setExpenses] = useState([]);

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
    setPreview(URL.createObjectURL(f));
    setProcessing(true);
    setResult(null);
    setShowManual(false);
    setSaved(false);
    try {
      const { data } = await expenseAPI.ocr(f);
      setResult(data.ocr_data);
      // Auto-fill form with OCR data
      fillFromOCR(data.ocr_data, false);
    } catch {
      setResult({ error: 'No se pudo procesar. Ingresa datos manualmente.' });
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

  const handleSave = async () => {
    if (!form.valor || parseFloat(form.valor) <= 0) return alert('Ingresa el valor del gasto');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
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
        <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Camera size={16} className="text-orange-500" /> Escaneo Inteligente de Facturas</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">Toma una foto de cualquier factura o ingresa los datos manualmente.</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
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
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Total *</label>
                <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="$0" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">IVA</label>
                <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} placeholder="$0" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

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

            {!file && (
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Foto del soporte</label>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
            )}

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

      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><FileText size={16} className="text-colsein-500" /> Documentos Soportados</h3>
        {['🧾 Tiquetes de peaje', '🅿️ Recibos de parqueadero', '🚕 Recibos de taxi / apps', '🍽️ Facturas de restaurantes', '🏨 Facturas de hotel'].map((t, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xl">{t.split(' ')[0]}</span>
            <span className="text-sm font-semibold">{t.split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
      </div>
    </>
  );
}
