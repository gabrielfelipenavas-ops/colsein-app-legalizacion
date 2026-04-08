import { useState, useEffect, useRef } from 'react';
import { Search, Upload, Plus, Users, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { clientAPI } from '../services/api';

export default function ClientesPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNit, setNewNit] = useState('');
  const [newCity, setNewCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await clientAPI.list({ activo: 'all', limit: 500 });
      setClients(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.nit && c.nit.includes(search)) ||
    (c.ciudad && c.ciudad.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await clientAPI.create({ nombre: newName.trim(), nit: newNit.trim() || null, ciudad: newCity.trim() || null });
      setNewName(''); setNewNit(''); setNewCity('');
      setShowAdd(false);
      await load();
    } catch (err) {
      alert('Error al crear cliente');
    }
    setSaving(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await clientAPI.import(file);
      setImportResult(data);
      await load();
    } catch (err) {
      setImportResult({ message: err.response?.data?.error || 'Error al importar', created: 0, skipped: 0, errors: [err.message] });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="px-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-colsein-500" />
          <h2 className="text-lg font-extrabold">Clientes</h2>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{clients.length}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3.5 py-2.5 bg-colsein-500 text-white rounded-xl text-xs font-semibold hover:bg-colsein-600 transition-colors">
          <Plus size={14} /> Nuevo
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-colors">
          <Upload size={14} /> {importing ? 'Importando...' : 'Importar Excel/CSV'}
        </button>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-3.5 rounded-xl border ${importResult.created > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {importResult.created > 0 ? <CheckCircle size={16} className="text-emerald-500 mt-0.5" /> : <AlertTriangle size={16} className="text-amber-500 mt-0.5" />}
              <div>
                <p className="text-sm font-semibold">{importResult.message}</p>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 text-[11px] text-red-600">
                    {importResult.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
                    {importResult.errors.length > 5 && <p>...y {importResult.errors.length - 5} errores más</p>}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* NetSuite help */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-[11px] text-blue-700 leading-relaxed">
          <strong>Importar desde NetSuite:</strong> Descarga el reporte de clientes en Excel (.xlsx) o CSV. El sistema detecta automáticamente columnas como: Nombre, NIT, Dirección, Ciudad, Departamento, Zona, Contacto, Teléfono. Los clientes que ya existen se omiten.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Buscar por nombre, NIT o ciudad..." value={search} onChange={e => setSearch(e.target.value)} className="input-field !pl-9" />
      </div>

      {/* Quick add form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Nuevo Cliente</h3>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <div className="space-y-2.5">
            <div><label className="label-field">Nombre *</label><input placeholder="Ej: Super De Alimentos" value={newName} onChange={e => setNewName(e.target.value)} className="input-field" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label-field">NIT</label><input placeholder="Ej: 900123456" value={newNit} onChange={e => setNewNit(e.target.value)} className="input-field" /></div>
              <div><label className="label-field">Ciudad</label><input placeholder="Ej: Dosquebradas" value={newCity} onChange={e => setNewCity(e.target.value)} className="input-field" /></div>
            </div>
            <button onClick={handleCreate} disabled={!newName.trim() || saving} className="btn-primary w-full !py-2.5">
              {saving ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-colsein-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Cargando clientes...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{c.nombre}</p>
                  <div className="flex gap-3 mt-1">
                    {c.nit && <p className="text-[11px] text-slate-400">NIT: {c.nit}</p>}
                    {c.ciudad && <p className="text-[11px] text-slate-400">{c.ciudad}{c.departamento ? `, ${c.departamento}` : ''}</p>}
                    {c.zona && <p className="text-[11px] text-colsein-500 font-semibold">{c.zona}</p>}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">No se encontraron clientes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
