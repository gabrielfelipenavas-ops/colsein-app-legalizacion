import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, X, FileText, Route, Briefcase, Image as ImageIcon, MapPin, Calendar, User, Bell } from 'lucide-react';
import { kmAPI, anticipoAPI, legalizationAPI, expenseAPI, authorizationAPI } from '../services/api';
import { fmt, dateStr, monthName, ESTADOS_LABEL, ESTADOS_COLOR } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

function StatusBadge({ status }) {
  const label = ESTADOS_LABEL[status] || status;
  const color = ESTADOS_COLOR[status] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>{label}</span>;
}

function ImageThumb({ src, alt }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  const url = src.startsWith('http') ? src : src;
  return (
    <>
      <button onClick={() => setOpen(true)} className="block">
        <img src={url} alt={alt} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <button onClick={() => setOpen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center"><X size={20} /></button>
          <img src={url} alt={alt} className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function ApprovalActions({ onApprove, onReject, disabled }) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try { await onApprove(comentarios); } finally { setLoading(false); }
  };
  const handleReject = async () => {
    if (!comentarios.trim()) {
      alert('Debes incluir un comentario explicando por qué no se aprueba.');
      return;
    }
    setLoading(true);
    try { await onReject(comentarios); } finally { setLoading(false); }
  };

  if (disabled) {
    return <div className="text-center text-xs text-slate-400 py-2">Solo lectura</div>;
  }

  return (
    <div className="space-y-2">
      {showRejectForm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <label className="text-xs font-semibold text-red-700 mb-1 block">Motivo de rechazo (obligatorio)</label>
          <textarea
            value={comentarios}
            onChange={e => setComentarios(e.target.value)}
            placeholder="Explica por qué no se autoriza..."
            rows={3}
            className="w-full border border-red-200 rounded-lg p-2 text-sm bg-white"
          />
        </div>
      )}
      {!showRejectForm && (
        <textarea
          value={comentarios}
          onChange={e => setComentarios(e.target.value)}
          placeholder="Comentario opcional..."
          rows={2}
          className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
        />
      )}
      <div className="flex gap-2">
        {showRejectForm ? (
          <>
            <button onClick={() => setShowRejectForm(false)} className="btn-outline flex-1 !py-2.5 !text-xs">Cancelar</button>
            <button onClick={handleReject} disabled={loading} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1">
              <XCircle size={14} /> {loading ? 'Rechazando...' : 'Confirmar rechazo'}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowRejectForm(true)} className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-red-300 text-red-600 bg-white hover:bg-red-50 flex items-center justify-center gap-1">
              <XCircle size={14} /> Rechazar
            </button>
            <button onClick={handleApprove} disabled={loading} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1">
              <CheckCircle size={14} /> {loading ? 'Aprobando...' : 'Aprobar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function KilometrajeReview({ report, onClose, onAction, canAct }) {
  const entries = report.entries || [];
  return (
    <Modal title={`Reporte Km — ${monthName(report.periodo_mes - 1)} ${report.periodo_anio}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm font-bold mb-1"><User size={14} /> {report.User?.nombre}</div>
          <p className="text-xs text-slate-500">CC {report.User?.cedula} · {report.User?.zona} · {report.User?.vehiculo_tipo} {report.User?.placa}</p>
          <div className="mt-2"><StatusBadge status={report.estado} /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Total Km</p>
            <p className="text-sm font-extrabold">{parseFloat(report.total_km || 0)} km</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Valor total</p>
            <p className="text-sm font-extrabold text-emerald-700">{fmt(parseFloat(report.valor_total || 0))}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Peajes</p>
            <p className="text-xs font-bold">{fmt(parseFloat(report.total_peajes || 0))}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Taxis + Parq.</p>
            <p className="text-xs font-bold">{fmt(parseFloat(report.total_taxis || 0) + parseFloat(report.total_parqueaderos || 0))}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold mb-2">Registros ({entries.length})</p>
          <div className="space-y-2 max-h-[40vh] overflow-auto">
            {entries.map(e => (
              <div key={e.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <p className="text-xs font-bold">{e.cliente_nombre}</p>
                  <p className="text-[10px] text-slate-400">{dateStr(e.fecha)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 mb-2">
                  <div><span className="font-bold text-slate-700">{e.medio}</span> · {parseFloat(e.total_km)} km</div>
                  <div>Valor: {fmt(parseFloat(e.valor_km || 0))}</div>
                  <div>Total: {fmt(parseFloat(e.valor_km || 0) + parseFloat(e.peajes || 0) + parseFloat(e.parqueaderos || 0) + parseFloat(e.taxis || 0) + parseFloat(e.otros || 0))}</div>
                </div>
                {parseFloat(e.distancia_api || 0) > 0 && (
                  <p className="text-[10px] text-slate-400 mb-2">
                    📍 Estimado GPS: <strong className="text-colsein-600">{parseFloat(e.distancia_api)} km</strong>
                    {' · '}Registrado por el vendedor: <strong className="text-slate-700">{parseFloat(e.total_km)} km</strong>
                  </p>
                )}
                {(parseFloat(e.peajes) > 0 || parseFloat(e.parqueaderos) > 0 || parseFloat(e.taxis) > 0 || parseFloat(e.otros) > 0) && (
                  <div className="flex gap-2 flex-wrap">
                    {parseFloat(e.peajes) > 0 && (
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 mb-0.5">Peaje {fmt(e.peajes)}</p>
                        {e.peaje_foto ? <ImageThumb src={e.peaje_foto} alt="peaje" /> : <span className="text-[9px] text-red-500">Sin foto</span>}
                      </div>
                    )}
                    {parseFloat(e.parqueaderos) > 0 && (
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 mb-0.5">Parq. {fmt(e.parqueaderos)}</p>
                        {e.parqueadero_foto ? <ImageThumb src={e.parqueadero_foto} alt="parq" /> : <span className="text-[9px] text-red-500">Sin foto</span>}
                      </div>
                    )}
                    {parseFloat(e.taxis) > 0 && (
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 mb-0.5">Taxi {fmt(e.taxis)}</p>
                        {e.taxi_foto ? <ImageThumb src={e.taxi_foto} alt="taxi" /> : <span className="text-[9px] text-red-500">Sin foto</span>}
                      </div>
                    )}
                    {parseFloat(e.otros) > 0 && (
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 mb-0.5">Otros {fmt(e.otros)}</p>
                        {e.otros_foto ? <ImageThumb src={e.otros_foto} alt="otros" /> : <span className="text-[9px] text-red-500">Sin foto</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {report.observaciones && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-700">Observaciones previas</p>
            <p className="text-xs text-amber-900 mt-1">{report.observaciones}</p>
          </div>
        )}

        <ApprovalActions
          disabled={!canAct}
          onApprove={(c) => onAction('aprobar', c)}
          onReject={(c) => onAction('rechazar', c)}
        />
      </div>
    </Modal>
  );
}

function AnticipoReview({ anticipo, onClose, onAction, canAct }) {
  return (
    <Modal title={`Anticipo ${anticipo.consecutivo}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm font-bold mb-1"><User size={14} /> {anticipo.User?.nombre}</div>
          <p className="text-xs text-slate-500">{anticipo.User?.zona}</p>
          <div className="mt-2"><StatusBadge status={anticipo.estado} /></div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><MapPin size={12} /> Destino</p>
          <p className="text-sm">{anticipo.ciudad_destino} <span className="text-[10px] text-slate-400">({anticipo.destino_tipo})</span></p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Calendar size={12} /> Fechas</p>
          <p className="text-sm">{dateStr(anticipo.fecha_ida)} → {dateStr(anticipo.fecha_regreso)} <span className="text-[10px] text-slate-400">({anticipo.duracion_dias} días)</span></p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-700 mb-1">Motivo</p>
          <p className="text-xs text-slate-600">{anticipo.motivo}</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-bold text-slate-600 mb-1">Presupuesto diario</p>
          <Row k="Alojamiento/día" v={fmt(anticipo.alojamiento_dia)} />
          <Row k="Alimentación/día" v={fmt(anticipo.alimentacion_dia)} />
          <Row k="Transportes/día" v={fmt(anticipo.transportes_dia)} />
          <Row k="Imprevistos/día" v={fmt(anticipo.imprevistos_dia)} />
          <Row k="Representación/día" v={fmt(anticipo.representacion_dia)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Presupuesto total</p>
            <p className="text-sm font-bold">{fmt(parseFloat(anticipo.presupuesto_total))}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Anticipo solicitado</p>
            <p className="text-sm font-extrabold text-emerald-700">{fmt(parseFloat(anticipo.anticipo_total))}</p>
          </div>
        </div>

        {anticipo.observaciones && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-700">Observaciones</p>
            <p className="text-xs text-amber-900 mt-1">{anticipo.observaciones}</p>
          </div>
        )}

        <ApprovalActions
          disabled={!canAct}
          onApprove={(c) => onAction('aprobar', c)}
          onReject={(c) => onAction('rechazar', c)}
        />
      </div>
    </Modal>
  );
}

function LegalizacionReview({ legalizacion, onClose, onAction, canAct }) {
  let extra = {};
  try { extra = JSON.parse(legalizacion.observaciones_imprevistos || '{}'); } catch {}
  const expenses = legalizacion.expenses || [];

  return (
    <Modal title={`Legalización #${legalizacion.id}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm font-bold mb-1"><User size={14} /> {legalizacion.User?.nombre}</div>
          <p className="text-xs text-slate-500">{legalizacion.User?.zona}</p>
          <div className="mt-2 flex gap-2">
            <StatusBadge status={legalizacion.estado} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${extra.tipo === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {extra.tipo === 'local' ? 'Local' : 'Viaje'}
            </span>
          </div>
        </div>

        {legalizacion.TravelRequest && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-700">Anticipo vinculado</p>
            <p className="text-xs">{legalizacion.TravelRequest.consecutivo} — {legalizacion.TravelRequest.ciudad_destino}</p>
          </div>
        )}

        {legalizacion.ciudades_visitadas && (
          <div>
            <p className="text-xs font-bold text-slate-700 mb-1">Ciudades visitadas</p>
            <p className="text-xs text-slate-600">{legalizacion.ciudades_visitadas}</p>
          </div>
        )}

        {extra.motivo && (
          <div>
            <p className="text-xs font-bold text-slate-700 mb-1">Motivo</p>
            <p className="text-xs text-slate-600">{extra.motivo}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Gasto real</p>
            <p className="text-sm font-extrabold">{fmt(parseFloat(legalizacion.gasto_real_total || 0))}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500">Anticipo</p>
            <p className="text-sm font-bold">{fmt(parseFloat(legalizacion.valor_anticipo || 0))}</p>
          </div>
          {parseFloat(legalizacion.pago_favor_empresa || 0) > 0 && (
            <div className="bg-red-50 rounded-xl p-3 col-span-2">
              <p className="text-[10px] text-slate-500">Debe devolver a la empresa</p>
              <p className="text-sm font-bold text-red-700">{fmt(parseFloat(legalizacion.pago_favor_empresa))}</p>
            </div>
          )}
          {parseFloat(legalizacion.pago_favor_empleado || 0) > 0 && (
            <div className="bg-emerald-50 rounded-xl p-3 col-span-2">
              <p className="text-[10px] text-slate-500">Reembolsar al empleado</p>
              <p className="text-sm font-bold text-emerald-700">{fmt(parseFloat(legalizacion.pago_favor_empleado))}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold mb-2">Gastos ({expenses.length})</p>
          <div className="space-y-2 max-h-[40vh] overflow-auto">
            {expenses.map(exp => (
              <div key={exp.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <p className="text-xs font-bold capitalize">{exp.categoria}</p>
                  <p className="text-sm font-extrabold text-colsein-600">{fmt(parseFloat(exp.valor || 0))}</p>
                </div>
                <p className="text-[10px] text-slate-500">{dateStr(exp.fecha)} · {exp.establecimiento || 'Sin establecimiento'}</p>
                {exp.numero_factura && <p className="text-[10px] text-slate-400">Factura: {exp.numero_factura}</p>}
                {exp.imagen_url && (
                  <div className="mt-2">
                    <ImageThumb src={exp.imagen_url} alt={exp.categoria} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <ApprovalActions
          disabled={!canAct}
          onApprove={(c) => onAction('aprobar', c)}
          onReject={(c) => onAction('rechazar', c)}
        />
      </div>
    </Modal>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] bg-white flex flex-col sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:max-h-[92vh] sm:rounded-3xl sm:shadow-2xl overflow-hidden">
        <div className="shrink-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 p-1"><X size={22} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}

export default function AprobacionesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('legalizaciones');
  const [items, setItems] = useState({ kilometrajes: [], anticipos: [], legalizaciones: [], autorizaciones: [] });
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const esAutorizador = ['gerente_ventas', 'gerente_general', 'presidente'].includes(user?.rol);

  const APROBADORES = ['lider_regional', 'gerente_ventas', 'gerente_general', 'presidente'];
  const GERENTES = ['gerente_ventas', 'gerente_general'];
  const canApproveItem = (item) => {
    const rol = user?.rol;
    // Administrador, control interno y contabilidad: solo lectura/auditoría, no aprueban
    if (!APROBADORES.includes(rol)) return false;

    // Nadie aprueba sus propias solicitudes
    const emisorId = item.user_id ?? item.User?.id;
    if (emisorId === user?.id) return false;

    // Jerarquía: lo del presidente no requiere autorización; lo de los gerentes
    // SOLO lo autoriza el presidente; lo de admin → gerente general/presidente
    const emisor = item.User?.rol;
    if (emisor === 'presidente') return false;
    if (GERENTES.includes(emisor) && rol !== 'presidente') return false;
    if (emisor === 'administrador' && !['gerente_general', 'presidente'].includes(rol)) return false;

    if (tab === 'legalizaciones') return ['enviado', 'revisado'].includes(item.estado);
    if (tab === 'kilometrajes') {
      if (rol === 'lider_regional') return item.estado === 'enviado';
      return ['enviado', 'revisado'].includes(item.estado);
    }
    return item.estado === 'enviado'; // anticipos
  };

  // ¿Puede el usuario decidir una solicitud de autorización (taxi / gasto especial / modificación)?
  const canDecideAutorizacion = (sol) => {
    if (!esAutorizador) return false;
    if (sol.user_id === user?.id) return false; // nadie se autoriza a sí mismo
    if (GERENTES.includes(sol.User?.rol) && user?.rol !== 'presidente') return false; // lo de gerentes → solo presidente
    return true;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [km, ant, leg, autoriz] = await Promise.all([
        kmAPI.getPending().catch(() => ({ data: [] })),
        anticipoAPI.pending().catch(() => ({ data: [] })),
        legalizationAPI.pending().catch(() => ({ data: [] })),
        esAutorizador ? authorizationAPI.pending().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setItems({ kilometrajes: km.data, anticipos: ant.data, legalizaciones: leg.data, autorizaciones: autoriz.data });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleAction = async (action, comentarios) => {
    if (!reviewing) return;
    try {
      if (reviewing.type === 'kilometraje') {
        await kmAPI.approveReport(reviewing.data.id, action, comentarios);
      } else if (reviewing.type === 'anticipo') {
        await anticipoAPI.approve(reviewing.data.id, action, comentarios);
      } else {
        await legalizationAPI.approve(reviewing.data.id, action, comentarios);
      }
      setReviewing(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al procesar');
    }
  };

  const decidirAutorizacion = async (id, action, comentarios) => {
    try {
      await authorizationAPI.decide(id, action, comentarios);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al procesar la autorización');
    }
  };

  const counts = {
    kilometrajes: items.kilometrajes.filter(r => ['enviado', 'revisado'].includes(r.estado)).length,
    anticipos: items.anticipos.filter(r => r.estado === 'enviado').length,
    legalizaciones: items.legalizaciones.filter(r => ['enviado', 'revisado'].includes(r.estado)).length,
    autorizaciones: items.autorizaciones.filter(r => r.estado === 'pendiente').length,
  };

  const TABS = [
    { id: 'legalizaciones', label: 'Legalizaciones', icon: FileText },
    { id: 'kilometrajes', label: 'Kilometraje', icon: Route },
    { id: 'anticipos', label: 'Anticipos', icon: Briefcase },
    ...(esAutorizador ? [{ id: 'autorizaciones', label: 'Autorizaciones', icon: Bell }] : []),
  ];

  return (
    <>
      <div className="px-4 mb-3">
        <h2 className="text-lg font-extrabold mb-1">Aprobaciones</h2>
        <p className="text-xs text-slate-400">Revisa y autoriza las solicitudes pendientes</p>
      </div>

      <div className="px-4 mb-3 flex gap-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 relative ${tab === t.id ? 'bg-colsein-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
          >
            <t.icon size={12} />
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`min-w-[18px] h-[18px] rounded-full text-[9px] font-extrabold flex items-center justify-center px-1 ${tab === t.id ? 'bg-white text-colsein-600' : 'bg-red-500 text-white'}`}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading && <p className="text-center text-xs text-slate-400 py-8">Cargando...</p>}

        {!loading && tab === 'legalizaciones' && (
          items.legalizaciones.length === 0
            ? <p className="text-center text-xs text-slate-400 py-12">No hay legalizaciones para revisar.</p>
            : items.legalizaciones.map(leg => {
                let extra = {};
                try { extra = JSON.parse(leg.observaciones_imprevistos || '{}'); } catch {}
                return (
                  <button key={leg.id} onClick={() => setReviewing({ type: 'legalizacion', data: leg })}
                    className="w-full text-left card mb-2 hover:bg-slate-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold">Legalización #{leg.id}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${extra.tipo === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {extra.tipo === 'local' ? 'Local' : 'Viaje'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{leg.User?.nombre}</p>
                        <p className="text-[10px] text-slate-400">{leg.expenses?.length || 0} gasto(s) · {dateStr(leg.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={leg.estado} />
                        <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(leg.gasto_real_total || 0))}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-0.5"><Eye size={10} /> Revisar</p>
                      </div>
                    </div>
                  </button>
                );
              })
        )}

        {!loading && tab === 'kilometrajes' && (
          items.kilometrajes.length === 0
            ? <p className="text-center text-xs text-slate-400 py-12">No hay reportes de kilometraje para revisar.</p>
            : items.kilometrajes.map(report => (
                <button key={report.id} onClick={() => setReviewing({ type: 'kilometraje', data: report })}
                  className="w-full text-left card mb-2 hover:bg-slate-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Kilometraje · {monthName(report.periodo_mes - 1)} {report.periodo_anio}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{report.User?.nombre}</p>
                      <p className="text-[10px] text-slate-400">{report.entries?.length || 0} registros · {parseFloat(report.total_km || 0)} km</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={report.estado} />
                      <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(report.valor_total || 0))}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-0.5"><Eye size={10} /> Revisar</p>
                    </div>
                  </div>
                </button>
              ))
        )}

        {!loading && tab === 'anticipos' && (
          items.anticipos.length === 0
            ? <p className="text-center text-xs text-slate-400 py-12">No hay anticipos para revisar.</p>
            : items.anticipos.map(ant => (
                <button key={ant.id} onClick={() => setReviewing({ type: 'anticipo', data: ant })}
                  className="w-full text-left card mb-2 hover:bg-slate-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{ant.consecutivo} — {ant.ciudad_destino}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ant.User?.nombre}</p>
                      <p className="text-[10px] text-slate-400">{dateStr(ant.fecha_ida)} → {dateStr(ant.fecha_regreso)}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={ant.estado} />
                      <p className="text-sm font-extrabold text-colsein-600 mt-1">{fmt(parseFloat(ant.anticipo_total || 0))}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-0.5"><Eye size={10} /> Revisar</p>
                    </div>
                  </div>
                </button>
              ))
        )}

        {!loading && tab === 'autorizaciones' && (
          items.autorizaciones.filter(a => a.estado === 'pendiente').length === 0
            ? <p className="text-center text-xs text-slate-400 py-12">No hay solicitudes de autorización pendientes.</p>
            : items.autorizaciones.filter(a => a.estado === 'pendiente').map(sol => (
                <div key={sol.id} className="card mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold flex items-center gap-1">
                        <Bell size={13} className="text-violet-500" /> {sol.concepto}
                        {sol.tipo === 'modificacion' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">Modificación</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{sol.User?.nombre} · {sol.User?.zona}</p>
                      {sol.detalle && <p className="text-[10px] text-slate-400 mt-0.5">{sol.detalle}</p>}
                    </div>
                    {parseFloat(sol.monto) > 0 && <p className="text-sm font-extrabold text-colsein-600 shrink-0 ml-2">{fmt(parseFloat(sol.monto))}</p>}
                  </div>
                  {canDecideAutorizacion(sol) ? (
                    <div className="flex gap-2">
                      <button onClick={() => { const c = prompt('Motivo del rechazo (obligatorio):'); if (c && c.trim()) decidirAutorizacion(sol.id, 'rechazar', c.trim()); }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold border border-red-300 text-red-600 bg-white hover:bg-red-50 flex items-center justify-center gap-1">
                        <XCircle size={14} /> Rechazar
                      </button>
                      <button onClick={() => decidirAutorizacion(sol.id, 'autorizar', '')}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center gap-1">
                        <CheckCircle size={14} /> Autorizar
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 text-center py-1">
                      {sol.user_id === user?.id ? 'Tu propia solicitud: la autoriza otro nivel' : 'Esta solicitud la autoriza el presidente'}
                    </p>
                  )}
                </div>
              ))
        )}
      </div>

      {reviewing?.type === 'kilometraje' && (
        <KilometrajeReview report={reviewing.data} onClose={() => setReviewing(null)} onAction={handleAction} canAct={canApproveItem(reviewing.data)} />
      )}
      {reviewing?.type === 'anticipo' && (
        <AnticipoReview anticipo={reviewing.data} onClose={() => setReviewing(null)} onAction={handleAction} canAct={canApproveItem(reviewing.data)} />
      )}
      {reviewing?.type === 'legalizacion' && (
        <LegalizacionReview legalizacion={reviewing.data} onClose={() => setReviewing(null)} onAction={handleAction} canAct={canApproveItem(reviewing.data)} />
      )}
    </>
  );
}
