import { useState, useRef } from 'react';
import { Camera, FileText, CheckCircle, Edit, Upload } from 'lucide-react';
import { expenseAPI } from '../services/api';

export default function FacturasPage() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setProcessing(true);
    setResult(null);
    try {
      const { data } = await expenseAPI.ocr(file);
      setResult(data.ocr_data);
    } catch {
      setResult({ error: 'No se pudo procesar. Ingresa datos manualmente.' });
    }
    setProcessing(false);
  };

  return (
    <>
      <div className="card mx-4">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Camera size={16} className="text-orange-500" /> Escaneo Inteligente de Facturas</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">Toma una foto de cualquier factura. La IA extraerá automáticamente los datos.</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="btn-primary w-full !bg-amber-500 hover:!bg-amber-600">
          <Camera size={18} /> Escanear Factura
        </button>
      </div>

      {preview && (
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
                <button className="btn-primary flex-1 !py-2 !text-xs"><CheckCircle size={14} /> Guardar</button>
                <button onClick={() => { setPreview(null); setResult(null); }} className="btn-outline flex-1 !py-2 !text-xs"><Edit size={14} /> Reintentar</button>
              </div>
            </div>
          )}
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-semibold text-red-600">{result.error}</div>
          )}
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
