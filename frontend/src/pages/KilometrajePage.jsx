import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, ArrowRight, Receipt, Car, Bike, CheckCircle, AlertTriangle, Send } from 'lucide-react';
import { kmAPI, reportAPI } from '../services/api';
import { fmt, fmtNum, dateStr, calcKm, monthName } from '../utils/helpers';
import AddEntryModal from '../components/AddEntryModal';

export default function KilometrajePage() {
  const [reports, setReports] = useState([]);
  const [period, setPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    kmAPI.getReports({ mes: period.month, anio: period.year }).then(r => setReports(r.data)).catch(() => {});
  };
  useEffect(load, [period]);

  const report = reports[0];
  const entries = report?.entries || [];
  const totalKm = parseFloat(report?.total_km || 0);
  const totalValorKm = parseFloat(report?.total_valor_km || 0);
  const totalPeajes = parseFloat(report?.total_peajes || 0);
  const totalTaxis = parseFloat(report?.total_taxis || 0);
  const valorTotal = parseFloat(report?.valor_total || 0);

  const prevMonth = () => setPeriod(p => ({ month: p.month === 1 ? 12 : p.month - 1, year: p.month === 1 ? p.year - 1 : p.year }));
  const nextMonth = () => setPeriod(p => ({ month: p.month === 12 ? 1 : p.month + 1, year: p.month === 12 ? p.year + 1 : p.year }));

  const handleSubmit = async () => {
    if (!report) return;
    try {
      await kmAPI.submitReport(report.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
    }
  };

  const downloadExcel = async () => {
    if (!report) return;
    try {
      const { data } = await reportAPI.downloadKmExcel(report.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Registro_Transporte_${monthName(period.month - 1)}_${period.year}.xlsx`;
      a.click();
    } catch { alert('Error al generar Excel'); }
  };

  return (
    <>
      {/* Period Selector */}
      <div className="card mx-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="btn-outline !p-2 !rounded-lg"><ArrowLeft size={16} /></button>
          <div className="text-center">
            <p className="text-base font-extrabold text-colsein-600">{monthName(period.month - 1)} {period.year}</p>
            <p className="text-[11px] text-slate-400">{entries.length} registros {report?.estado && `· ${report.estado}`}</p>
          </div>
          <button onClick={nextMonth} className="btn-outline !p-2 !rounded-lg"><ArrowRight size={16} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 pt-3 grid grid-cols-4 gap-1.5">
        {[
          { l: 'Kilometraje', v: fmt(totalValorKm), s: `${fmtNum(totalKm)} km` },
          { l: 'Peajes', v: fmt(totalPeajes) },
          { l: 'Taxis', v: fmt(totalTaxis) },
          { l: 'Total', v: fmt(valorTotal), s: 'A pagar' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-2.5 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-[9px] text-slate-400 font-semibold uppercase">{s.l}</p>
            <p className="text-[13px] font-extrabold text-colsein-600 mt-1 tracking-tight">{s.v}</p>
            {s.s && <p className="text-[9px] text-slate-400 mt-0.5">{s.s}</p>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 flex gap-2">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex-1"><Plus size={18} /> Registrar Visita</button>
        {report && report.estado === 'borrador' && entries.length > 0 && (
          <button onClick={handleSubmit} className="btn-outline !px-3"><Send size={16} /></button>
        )}
      </div>

      {/* Table */}
      <div className="card mx-4 mt-3 !p-3 overflow-x-auto">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-2"><Receipt size={16} className="text-colsein-500" /> Detalle</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Fecha</th>
              <th className="text-left py-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Cliente</th>
              <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Medio</th>
              <th className="text-right py-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Km</th>
              <th className="text-right py-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Valor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const tk = parseFloat(e.total_km);
              const val = parseFloat(e.valor_km) + parseFloat(e.peajes||0) + parseFloat(e.parqueaderos||0) + parseFloat(e.taxis||0) + parseFloat(e.otros||0);
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2 px-1 font-mono text-[11px] whitespace-nowrap">{dateStr(e.fecha)}</td>
                  <td className="py-2 px-1 font-semibold max-w-[100px] truncate">{e.cliente_nombre}</td>
                  <td className="py-2 px-1 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${e.medio === 'CARRO' ? 'bg-colsein-50 text-colsein-600' : 'bg-amber-50 text-amber-600'}`}>
                      {e.medio === 'CARRO' ? <Car size={10} /> : <Bike size={10} />} {e.medio}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-right font-mono">{tk}</td>
                  <td className="py-2 px-1 text-right font-bold font-mono text-colsein-600">{fmt(val)}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-8">No hay registros para este periodo</td></tr>
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td colSpan={3} className="py-2 px-1">TOTAL</td>
                <td className="py-2 px-1 text-right font-mono">{fmtNum(totalKm)}</td>
                <td className="py-2 px-1 text-right font-mono text-colsein-600">{fmt(valorTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Download */}
      {report && entries.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <button onClick={downloadExcel} className="btn-outline w-full !text-emerald-600 !border-emerald-500 hover:!bg-emerald-50">
            📊 Descargar Excel Formato Oficial
          </button>
        </div>
      )}

      {/* Policy */}
      <div className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex gap-2.5 items-start">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>Tarifas vigentes:</strong> Carro $600,65/km · Moto $507,03/km. Entregar antes del 5 del mes siguiente. No es acumulable.
          </p>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAdd && <AddEntryModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </>
  );
}
