import { useState, useEffect } from 'react';
import { BarChart3, DollarSign, Download, FileText, ChevronRight, TrendingUp, Package, Calendar } from 'lucide-react';
import { reportAPI, kmAPI, legalizationAPI } from '../services/api';
import { fmt, fmtNum, monthName } from '../utils/helpers';

export default function ReportesPage() {
  const [dashboard, setDashboard] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPack, setDownloadingPack] = useState(false);
  const [legalizations, setLegalizations] = useState([]);
  const [packMonth, setPackMonth] = useState(new Date().getMonth() + 1);
  const [packYear, setPackYear] = useState(new Date().getFullYear());

  useEffect(() => {
    reportAPI.dashboard().then(r => setDashboard(r.data)).catch(() => {});
    legalizationAPI.list().then(r => setLegalizations(r.data)).catch(() => {});
  }, []);

  const report = dashboard?.current_report;
  const yearReports = dashboard?.year_reports || [];
  const totalKm = parseFloat(report?.total_km || 0);
  const totalValorKm = parseFloat(report?.total_valor_km || 0);
  const totalPeajes = parseFloat(report?.total_peajes || 0);
  const totalParqueaderos = parseFloat(report?.total_parqueaderos || 0);
  const totalTaxis = parseFloat(report?.total_taxis || 0);
  const totalOtros = parseFloat(report?.total_otros || 0);
  const valorTotal = parseFloat(report?.valor_total || 0);

  const downloadExcel = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const { data } = await reportAPI.downloadKmExcel(report.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Registro_Transporte.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar Excel'); }
    setDownloading(false);
  };

  const downloadLegExcel = async () => {
    if (legalizations.length === 0) return;
    const latest = legalizations[0];
    setDownloading(true);
    try {
      const { data } = await reportAPI.downloadLegalizacionExcel(latest.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Legalizacion_Gastos_${latest.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar Excel'); }
    setDownloading(false);
  };

  const downloadMonthlyPack = async () => {
    setDownloadingPack(true);
    try {
      const { data } = await reportAPI.downloadMonthlyPack(packYear, packMonth);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Paquete_${monthName(packMonth - 1)}_${packYear}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar paquete mensual'); }
    setDownloadingPack(false);
  };

  const desglose = [
    { label: 'Kilometraje', value: totalValorKm, color: 'bg-colsein-500' },
    { label: 'Peajes', value: totalPeajes, color: 'bg-orange-500' },
    { label: 'Parqueaderos', value: totalParqueaderos, color: 'bg-amber-500' },
    { label: 'Taxis', value: totalTaxis, color: 'bg-violet-500' },
    { label: 'Otros', value: totalOtros, color: 'bg-slate-400' },
  ];

  return (
    <>
      {/* Summary */}
      <div className="card mx-4">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4"><BarChart3 size={16} className="text-colsein-500" /> Resumen del Periodo</h3>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-colsein-600">{fmtNum(totalKm)}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Km Totales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-emerald-600">{dashboard?.recent_entries?.length || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Visitas</p>
          </div>
        </div>

        {/* Year chart */}
        {yearReports.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Kilometraje por mes ({new Date().getFullYear()})</p>
            <div className="h-20 flex items-end gap-1">
              {Array.from({ length: 12 }, (_, i) => {
                const r = yearReports.find(yr => yr.periodo_mes === i + 1);
                const val = parseFloat(r?.valor_total || 0);
                const maxVal = Math.max(1, ...yearReports.map(yr => parseFloat(yr.valor_total || 0)));
                const h = val > 0 ? Math.max(8, (val / maxVal) * 70) : 3;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full rounded-sm transition-all ${val > 0 ? 'bg-colsein-500' : 'bg-slate-200'}`} style={{ height: h }} />
                    <span className="text-[8px] text-slate-400">{monthName(i).substring(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><DollarSign size={16} className="text-emerald-500" /> Desglose de Costos</h3>
        {desglose.map((item, i) => (
          <div key={i} className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-xs font-semibold">{item.label}</span>
              <span className="text-xs font-bold font-mono">{fmt(item.value)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: valorTotal > 0 ? `${(item.value / valorTotal) * 100}%` : '0%' }} />
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-3 mt-2 border-t-2 border-slate-200">
          <span className="text-sm font-extrabold">VALOR A PAGAR</span>
          <span className="text-base font-extrabold text-colsein-600 font-mono">{fmt(valorTotal)}</span>
        </div>
      </div>

      {/* Export */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Download size={16} className="text-amber-600" /> Generar Documentos</h3>
        {[
          { label: 'Registro de Medios de Transporte (Excel)', desc: 'Formato oficial V.08 con tarifas vigentes', action: downloadExcel, enabled: !!report },
          { label: 'Legalización de Gastos (Excel)', desc: 'Desglose por día y categoría', action: downloadLegExcel, enabled: legalizations.length > 0 },
        ].map((doc, i) => (
          <button key={i} onClick={doc.action} disabled={!doc.enabled || downloading} className="w-full flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 text-left disabled:opacity-40 hover:bg-slate-50 transition-colors rounded-lg px-1">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold">{doc.label}</p>
              <p className="text-[11px] text-slate-400">{doc.desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        ))}
      </div>

      {/* Monthly Pack Download */}
      <div className="card mx-4 mt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Package size={16} className="text-violet-500" /> Paquete Mensual</h3>
        <p className="text-xs text-slate-400 mb-3">Descarga un ZIP con todos los documentos del mes: legalizaciones, movilidad y facturas electrónicas.</p>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Mes</label>
            <select value={packMonth} onChange={e => setPackMonth(parseInt(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>{monthName(i)}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Año</label>
            <select value={packYear} onChange={e => setPackYear(parseInt(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white">
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={downloadMonthlyPack} disabled={downloadingPack}
          className="btn-primary w-full !py-3 !bg-violet-500 hover:!bg-violet-600 disabled:opacity-50">
          {downloadingPack
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
            : <><Download size={16} /> Descargar Paquete de {monthName(packMonth - 1)} {packYear}</>
          }
        </button>

        <div className="mt-3 bg-violet-50 rounded-xl p-2.5">
          <p className="text-[10px] font-bold text-violet-700 mb-1">El paquete incluye:</p>
          <ul className="text-[10px] text-violet-600 space-y-0.5">
            <li>- Excel de Registro de Transporte (movilidad)</li>
            <li>- Excel(s) de Legalización de Gastos</li>
            <li>- Facturas electrónicas vinculadas (PDF/XML)</li>
          </ul>
        </div>
      </div>

      {/* Trend */}
      <div className="card mx-4 mt-3 mb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><TrendingUp size={16} className="text-colsein-500" /> Próximamente</div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">Dashboard avanzado con mapa de visitas, ranking por vendedor, detección de anomalías y comparativas mensuales.</p>
      </div>
    </>
  );
}
