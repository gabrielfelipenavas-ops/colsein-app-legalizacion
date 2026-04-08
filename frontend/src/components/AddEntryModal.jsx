import { useState, useRef } from 'react';
import { X, Car, Bike, Plus, Check, Camera, Trash2, CheckCircle, AlertTriangle, MapPin, Receipt, Building2, DollarSign } from 'lucide-react';
import { kmAPI, clientAPI } from '../services/api';
import { fmt, fmtNum, TARIFAS, TIPOS_TAXI } from '../utils/helpers';

function PhotoUpload({ label, value, onChange, required, colorClass = 'border-emerald-500' }) {
  const ref = useRef(null);
  const handleFile = (e) => { const f = e.target.files?.[0]; if (f) onChange(f); };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      {value ? (
        <div className={`relative rounded-xl overflow-hidden border-2 ${colorClass}`}>
          <img src={typeof value === 'string' ? value : URL.createObjectURL(value)} alt={label} className="w-full h-24 object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex justify-between items-center">
            <span className="text-white text-[10px] font-semibold flex items-center gap-1"><CheckCircle size={12} /> Soporte adjunto</span>
            <button onClick={() => onChange(null)} className="text-white text-[10px] bg-white/25 rounded px-2 py-0.5 font-semibold flex items-center gap-1"><Trash2 size={10} /> Quitar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} className={`w-full p-4 ${required ? 'bg-red-50 border-red-400' : 'bg-slate-50 border-slate-300'} border-2 border-dashed rounded-xl text-center transition-colors hover:bg-slate-100`}>
          <div className="flex items-center justify-center gap-2">
            <Camera size={18} className={required ? 'text-red-500' : 'text-slate-400'} />
            <div>
              <p className={`text-xs font-semibold ${required ? 'text-red-500' : 'text-slate-500'}`}>{label}</p>
              {required && <p className="text-[10px] text-red-500 font-bold mt-0.5">⚠ SOPORTE OBLIGATORIO</p>}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

export default function AddEntryModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], cliente_nombre: '', medio: 'CARRO',
    km_inicial: '', km_final: '', peajes: '', parqueaderos: '', taxis: '',
    taxi_tipo: '', taxi_origen: '', taxi_destino: '', otros: '',
  });
  const [photos, setPhotos] = useState({ peaje: null, parqueadero: null, taxi: null, otros: null });
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [showClients, setShowClients] = useState(false);
  const [saving, setSaving] = useState(false);

  const [creatingClient, setCreatingClient] = useState(false);

  const searchClients = async (q) => {
    setSearch(q);
    if (q.length >= 2) {
      try {
        const { data } = await clientAPI.list({ search: q, limit: 8 });
        setClients(data);
        setShowClients(true);
      } catch { setClients([]); }
    } else { setShowClients(false); }
  };

  const createQuickClient = async () => {
    if (!search.trim() || creatingClient) return;
    setCreatingClient(true);
    try {
      const { data: newClient } = await clientAPI.create({ nombre: search.trim() });
      u('cliente_nombre', newClient.nombre);
      u('client_id', newClient.id);
      setSearch('');
      setShowClients(false);
    } catch (err) {
      alert('Error al crear cliente');
    }
    setCreatingClient(false);
  };

  const totalKm = Math.max(0, (parseInt(form.km_final) || 0) - (parseInt(form.km_inicial) || 0));
  const tarifa = form.medio === 'CARRO' ? TARIFAS.CARRO : TARIFAS.MOTO;
  const valorKm = Math.round(totalKm * tarifa);

  const peajeVal = parseInt(form.peajes) || 0;
  const parqVal = parseInt(form.parqueaderos) || 0;
  const taxiVal = parseInt(form.taxis) || 0;
  const otrosVal = parseInt(form.otros) || 0;

  const peajeNeedsFoto = peajeVal > 0 && !photos.peaje;
  const parqNeedsFoto = parqVal > 0 && !photos.parqueadero;
  const taxiNeedsFoto = taxiVal > 0 && !photos.taxi;
  const taxiNeedsInfo = taxiVal > 0 && (!form.taxi_tipo || !form.taxi_origen || !form.taxi_destino);
  const otrosNeedsFoto = otrosVal > 0 && !photos.otros;
  const missingFotos = peajeNeedsFoto || parqNeedsFoto || taxiNeedsFoto || otrosNeedsFoto;
  const canSave = form.cliente_nombre && form.km_final && totalKm > 0 && !missingFotos && !taxiNeedsInfo;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: entry } = await kmAPI.addEntry({
        ...form,
        km_inicial: parseInt(form.km_inicial) || 0,
        km_final: parseInt(form.km_final) || 0,
        peajes: peajeVal, parqueaderos: parqVal, taxis: taxiVal, otros: otrosVal,
      });
      // Upload photos
      for (const [key, file] of Object.entries(photos)) {
        if (file) {
          const fieldMap = { peaje: 'peaje_foto', parqueadero: 'parqueadero_foto', taxi: 'taxi_foto', otros: 'otros_foto' };
          await kmAPI.uploadPhoto(entry.id, fieldMap[key], file);
        }
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const u = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[92vh] overflow-auto p-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">Registrar Visita</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>

        {/* Fecha */}
        <div className="mb-3.5">
          <label className="label-field">Fecha</label>
          <input type="date" value={form.fecha} onChange={e => u('fecha', e.target.value)} className="input-field" />
        </div>

        {/* Cliente */}
        <div className="mb-3.5 relative">
          <label className="label-field">Cliente</label>
          <input placeholder="Buscar cliente..." value={form.cliente_nombre || search} onChange={e => { searchClients(e.target.value); u('cliente_nombre', ''); }} onFocus={() => search.length >= 2 && setShowClients(true)} className="input-field" />
          {showClients && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl max-h-48 overflow-auto z-10 shadow-lg mt-1">
              {clients.map(c => (
                <button key={c.id} onClick={() => { u('cliente_nombre', c.nombre); u('client_id', c.id); setSearch(''); setShowClients(false); }} className="block w-full px-3.5 py-2.5 border-b border-slate-100 text-left hover:bg-slate-50">
                  <p className="text-sm font-semibold">{c.nombre}</p>
                  <p className="text-[11px] text-slate-400">{c.ciudad}</p>
                </button>
              ))}
              {clients.length === 0 && search.length >= 2 && (
                <div className="px-3.5 py-2.5 text-center">
                  <p className="text-xs text-slate-400 mb-2">No se encontró "{search}"</p>
                  <button onClick={createQuickClient} disabled={creatingClient} className="w-full flex items-center justify-center gap-1.5 py-2 bg-colsein-50 text-colsein-600 rounded-lg text-xs font-semibold hover:bg-colsein-100 transition-colors">
                    <Plus size={14} />
                    {creatingClient ? 'Creando...' : `Crear "${search}"`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Medio */}
        <div className="mb-3.5">
          <label className="label-field">Medio</label>
          <div className="flex gap-2">
            {['CARRO', 'MOTO'].map(m => (
              <button key={m} onClick={() => u('medio', m)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${form.medio === m ? 'bg-colsein-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                {m === 'CARRO' ? <Car size={16} /> : <Bike size={16} />} {m}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-1">Tarifa: ${fmtNum(tarifa)}/km</p>
        </div>

        {/* KM */}
        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          <div><label className="label-field">Km Inicial</label><input type="number" placeholder="0" value={form.km_inicial} onChange={e => u('km_inicial', e.target.value)} className="input-field font-mono" /></div>
          <div><label className="label-field">Km Final</label><input type="number" placeholder="0" value={form.km_final} onChange={e => u('km_final', e.target.value)} className="input-field font-mono" /></div>
        </div>

        {totalKm > 0 && (
          <div className="bg-colsein-50 rounded-xl p-3.5 mb-4 flex justify-between items-center">
            <div><p className="text-[11px] text-colsein-600 font-semibold uppercase">Distancia</p><p className="text-xl font-extrabold text-colsein-600">{totalKm} km</p></div>
            <div className="text-right"><p className="text-[11px] text-colsein-600 font-semibold uppercase">Valor</p><p className="text-xl font-extrabold text-colsein-600">{fmt(valorKm)}</p></div>
          </div>
        )}

        {/* ── PEAJES ── */}
        <div className={`mb-3.5 p-3.5 bg-slate-50 rounded-xl border-[1.5px] ${peajeNeedsFoto ? 'border-red-400' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2.5"><Receipt size={16} className="text-orange-500" /><span className="text-[13px] font-bold">Peajes</span></div>
          <div className={peajeVal > 0 ? 'mb-2.5' : ''}><label className="label-field">Valor ($)</label><input type="number" placeholder="0" value={form.peajes} onChange={e => u('peajes', e.target.value)} className="input-field font-mono" /></div>
          {peajeVal > 0 && <PhotoUpload label="📸 Foto del tiquete de peaje" value={photos.peaje} onChange={f => setPhotos(p => ({...p, peaje: f}))} required={!photos.peaje} colorClass="border-orange-500" />}
        </div>

        {/* ── PARQUEADEROS ── */}
        <div className={`mb-3.5 p-3.5 bg-slate-50 rounded-xl border-[1.5px] ${parqNeedsFoto ? 'border-red-400' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2.5"><Building2 size={16} className="text-amber-500" /><span className="text-[13px] font-bold">Parqueaderos</span></div>
          <div className={parqVal > 0 ? 'mb-2.5' : ''}><label className="label-field">Valor ($)</label><input type="number" placeholder="0" value={form.parqueaderos} onChange={e => u('parqueaderos', e.target.value)} className="input-field font-mono" /></div>
          {parqVal > 0 && (
            <>
              <PhotoUpload label="📸 Foto del recibo de parqueadero" value={photos.parqueadero} onChange={f => setPhotos(p => ({...p, parqueadero: f}))} required={!photos.parqueadero} colorClass="border-amber-500" />
              <p className="mt-2 p-2 bg-amber-50 rounded-lg text-[10px] text-amber-800 leading-relaxed"><strong>Requisitos:</strong> Fecha, nombre establecimiento, NIT, régimen, dirección, resolución facturación, valor.</p>
            </>
          )}
        </div>

        {/* ── TAXIS ── */}
        <div className={`mb-3.5 p-3.5 bg-violet-50/60 rounded-xl border-[1.5px] ${(taxiNeedsFoto || taxiNeedsInfo) ? 'border-red-400' : 'border-violet-200'}`}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-base">🚕</span>
            <span className="text-[13px] font-bold">Taxis / Transporte Público</span>
            <span className="ml-auto text-[9px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">⚠ Autorización previa</span>
          </div>
          <div className={taxiVal > 0 ? 'mb-2.5' : ''}><label className="label-field">Valor ($)</label><input type="number" placeholder="0" value={form.taxis} onChange={e => u('taxis', e.target.value)} className="input-field font-mono" /></div>
          {taxiVal > 0 && (
            <>
              <div className="mb-2.5">
                <label className="label-field">Tipo de servicio</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_TAXI.map(t => (
                    <button key={t} onClick={() => u('taxi_tipo', t)} className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${form.taxi_tipo === t ? 'border-violet-500 bg-violet-100 text-violet-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {!form.taxi_tipo && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠ Selecciona el tipo</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div><label className="label-field">Origen</label><input placeholder="Ej: Hotel" value={form.taxi_origen} onChange={e => u('taxi_origen', e.target.value)} className="input-field !text-xs" /></div>
                <div><label className="label-field">Destino</label><input placeholder="Ej: SENA" value={form.taxi_destino} onChange={e => u('taxi_destino', e.target.value)} className="input-field !text-xs" /></div>
              </div>
              {form.taxi_origen && form.taxi_destino && (
                <p className="p-2 bg-violet-100 rounded-lg text-[11px] text-violet-700 font-semibold flex items-center gap-1.5 mb-2.5"><MapPin size={12} /> {form.taxi_origen} → {form.taxi_destino}</p>
              )}
              <PhotoUpload label="📸 Foto del recibo / captura de pantalla" value={photos.taxi} onChange={f => setPhotos(p => ({...p, taxi: f}))} required={!photos.taxi} colorClass="border-violet-500" />
              <p className="mt-2 p-2 bg-amber-50 rounded-lg text-[10px] text-amber-800 leading-relaxed"><strong>Nota:</strong> Taxis requieren autorización previa. Para casos puntuales de visita a clientes.</p>
            </>
          )}
        </div>

        {/* ── OTROS ── */}
        <div className={`mb-3.5 p-3.5 bg-slate-50 rounded-xl border-[1.5px] ${otrosNeedsFoto ? 'border-red-400' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2.5"><DollarSign size={16} className="text-slate-400" /><span className="text-[13px] font-bold">Otros Gastos</span></div>
          <div className={otrosVal > 0 ? 'mb-2.5' : ''}><label className="label-field">Valor ($)</label><input type="number" placeholder="0" value={form.otros} onChange={e => u('otros', e.target.value)} className="input-field font-mono" /></div>
          {otrosVal > 0 && <PhotoUpload label="📸 Foto del soporte" value={photos.otros} onChange={f => setPhotos(p => ({...p, otros: f}))} required={!photos.otros} />}
        </div>

        {/* Warnings */}
        {(missingFotos || taxiNeedsInfo) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4 space-y-1.5">
            {missingFotos && (
              <p className="flex items-center gap-2 text-xs font-semibold text-red-600"><AlertTriangle size={14} className="shrink-0" /> Sin soporte no se puede relacionar ningún valor.</p>
            )}
            {taxiNeedsInfo && (
              <p className="flex items-center gap-2 text-xs font-semibold text-red-600"><AlertTriangle size={14} className="shrink-0" /> Completa tipo, origen y destino del taxi.</p>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary w-full">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </div>
    </div>
  );
}
