import { useState, useEffect } from 'react';
import { Calculator, Download, Settings, ChevronDown, ChevronUp, Save, FileSpreadsheet } from 'lucide-react';
import { accountingAPI, reportAPI } from '../services/api';
import { fmt, monthName } from '../utils/helpers';

async function descargarBlob(promise, filename) {
  try {
    const { data } = await promise;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { alert('Error al descargar'); }
}

const CAT_LABELS = {
  alimentacion: 'Alimentación', alojamiento: 'Alojamiento', transportes: 'Transportes',
  imprevistos: 'Imprevistos', representacion: 'Representación', peaje: 'Peaje',
  parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro', __impoconsumo__: 'Imp. al consumo (línea)',
};

export default function ContabilidadPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [todas, setTodas] = useState(false);

  const loadAudit = async () => {
    setLoading(true);
    try { const { data } = await accountingAPI.monthAudit(year, month, todas); setAudit(data); }
    catch { setAudit(null); }
    setLoading(false);
  };
  const loadMappings = async () => {
    try { const { data } = await accountingAPI.mappings(); setMappings(data); } catch {}
  };
  useEffect(() => { loadAudit(); }, [year, month, todas]);
  useEffect(() => { loadMappings(); }, []);

  const setMapField = (id, field, value) =>
    setMappings(ms => ms.map(m => m.id === id ? { ...m, [field]: value } : m));

  const saveMap = async (m) => {
    setSavingId(m.id);
    try { await accountingAPI.updateMapping(m.id, m); } catch { alert('Error al guardar el mapeo'); }
    setSavingId(null);
  };

  const downloadFlat = async () => {
    setDownloading(true);
    try {
      const { data } = await accountingAPI.downloadFlat(year, month);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ARCHIVO_PLANO_${monthName(month - 1).toUpperCase()}_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el archivo plano'); }
    setDownloading(false);
  };

  return (
    <>
      <div className="px-4 mb-3">
        <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Calculator size={20} className="text-teal-600" /> Contabilidad</h2>
        <p className="text-xs text-slate-400">Audita las legalizaciones del mes y genera el archivo plano para NetSuite.</p>
      </div>

      {/* Selector de mes */}
      <div className="card mx-4 mb-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Mes</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i)}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Año</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {audit && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-teal-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-teal-700">{audit.total_legalizaciones}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Legalizaciones aprobadas</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-blue-700">{audit.total_lineas}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Líneas de gasto</p>
            </div>
          </div>
        )}
        <button onClick={downloadFlat} disabled={downloading || !audit || audit.total_lineas === 0}
          className="btn-primary w-full mt-3 !bg-teal-600 hover:!bg-teal-700 disabled:opacity-50">
          {downloading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</> : <><Download size={16} /> Generar archivo plano (NetSuite)</>}
        </button>
        <p className="text-[10px] text-slate-400 mt-2">El archivo plano solo incluye legalizaciones <strong>aprobadas</strong> con gastos del mes seleccionado.</p>
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input type="checkbox" checked={todas} onChange={e => setTodas(e.target.checked)} className="w-4 h-4 accent-teal-600" />
          <span className="text-[11px] font-semibold text-slate-600">Ver también las no aprobadas (auditoría)</span>
        </label>
      </div>

      {/* Editor de mapeo contable */}
      <div className="card mx-4 mb-3">
        <button onClick={() => setShowMap(s => !s)} className="w-full flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold"><Settings size={16} className="text-slate-500" /> Mapeo contable (cuentas)</span>
          {showMap ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showMap && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-slate-400">Inferido del archivo de ejemplo. Ajusta cuenta, ID y código de IVA por categoría.</p>
            {mappings.map(m => (
              <div key={m.id} className="border border-slate-200 rounded-xl p-2.5">
                <p className="text-xs font-bold text-slate-700 mb-1.5">{CAT_LABELS[m.categoria] || m.categoria}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={m.cuenta || ''} onChange={e => setMapField(m.id, 'cuenta', e.target.value)} placeholder="Cuenta" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                  <input value={m.cuenta_id || ''} onChange={e => setMapField(m.id, 'cuenta_id', e.target.value)} placeholder="ID cuenta" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                  <select value={m.concepto_tributario || 'COMPRAS'} onChange={e => setMapField(m.id, 'concepto_tributario', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    <option value="COMPRAS">COMPRAS</option>
                    <option value="SERVICIOS">SERVICIOS</option>
                  </select>
                  <input value={m.codigo_iva || ''} onChange={e => setMapField(m.id, 'codigo_iva', e.target.value)} placeholder="Código IVA" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <button onClick={() => saveMap(m)} disabled={savingId === m.id} className="mt-1.5 text-[11px] font-bold text-teal-600 flex items-center gap-1">
                  <Save size={11} /> {savingId === m.id ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auditoría: líneas del mes */}
      <div className="px-4">
        {loading && <p className="text-center text-xs text-slate-400 py-8">Cargando...</p>}
        {!loading && audit && audit.legalizaciones.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-12">No hay legalizaciones aprobadas con gastos en {monthName(month - 1)} {year}.</p>
        )}
        {!loading && audit && audit.legalizaciones.map(l => (
          <div key={l.id} className="card mb-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold flex items-center gap-1"><FileSpreadsheet size={14} className="text-teal-600" /> Legalización #{l.id}</p>
              <span className="text-[10px] text-slate-400">{l.usuario} · {l.zona}</span>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => descargarBlob(reportAPI.downloadLegalizacionExcel(l.id), `Legalizacion_${l.id}.xlsx`)}
                className="flex-1 py-1.5 rounded-lg border border-colsein-300 text-colsein-600 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-colsein-50">
                <Download size={11} /> Excel
              </button>
              <button onClick={() => descargarBlob(reportAPI.downloadLegalizacionFacturas(l.id), `Facturas_Legalizacion_${l.id}.zip`)}
                className="flex-1 py-1.5 rounded-lg border border-emerald-300 text-emerald-600 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-50">
                <Download size={11} /> Facturas
              </button>
            </div>
            <div className="space-y-1">
              {l.gastos.map(g => (
                <div key={g.id} className="flex justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{CAT_LABELS[g.categoria] || g.categoria} · {g.establecimiento || 's/n'}</p>
                    <p className="text-[10px] text-slate-400">{g.fecha}{g.numero_factura ? ` · ${g.numero_factura}` : ''}{parseFloat(g.impoconsumo) > 0 ? ` · INC ${fmt(g.impoconsumo)}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-bold text-teal-700">{fmt(g.valor_legalizable != null ? g.valor_legalizable : g.valor)}</p>
                    {parseFloat(g.propina) > 0 && <p className="text-[9px] text-slate-400">propina {fmt(g.propina)} (no cuenta)</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
