import { useState, useEffect } from 'react';
import { UserPlus, X, Eye, EyeOff, Shield, Search, Pencil, Power } from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'comercial', label: 'Comercial', color: 'bg-blue-100 text-blue-700' },
  { value: 'lider_regional', label: 'Líder Regional', color: 'bg-violet-100 text-violet-700' },
  { value: 'gerente_ventas', label: 'Gerente Ventas', color: 'bg-amber-100 text-amber-700' },
  { value: 'control_interno', label: 'Control Interno', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'administrador', label: 'Administrador', color: 'bg-red-100 text-red-700' },
];

const ZONAS = ['Eje Cafetero', 'Antioquia', 'Bogotá', 'Valle', 'Costa', 'Santander', 'Nacional'];

const emptyForm = {
  nombre: '', cedula: '', email: '', password: '', rol: 'comercial',
  zona: '', vehiculo_tipo: 'CARRO', placa: '', telefono: '', lider_regional_id: '',
};

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = currentUser?.rol === 'administrador';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.list();
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const lideres = users.filter(u => u.rol === 'lider_regional' && u.activo);

  const filtered = users.filter(u =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.cedula.includes(search)
  );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setShowPass(false);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({
      nombre: u.nombre, cedula: u.cedula, email: u.email, password: '',
      rol: u.rol, zona: u.zona || '', vehiculo_tipo: u.vehiculo_tipo || 'CARRO',
      placa: u.placa || '', telefono: u.telefono || '',
      lider_regional_id: u.lider_regional_id || '',
    });
    setError('');
    setShowPass(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre || !form.cedula || !form.email) {
      setError('Nombre, cédula y email son obligatorios');
      return;
    }
    if (!editingId && !form.password) {
      setError('La contraseña es obligatoria para usuarios nuevos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.lider_regional_id) payload.lider_regional_id = null;

      if (editingId) {
        await userAPI.update(editingId, payload);
      } else {
        await userAPI.create(payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActive = async (u) => {
    try {
      await userAPI.update(u.id, { activo: !u.activo });
      await load();
    } catch {
      alert('Error al cambiar estado');
    }
  };

  const u = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const rolInfo = (rol) => ROLES.find(r => r.value === rol) || ROLES[0];

  if (!isAdmin) {
    return (
      <div className="px-5 py-20 text-center">
        <Shield size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-500">Solo los administradores pueden gestionar usuarios</p>
        <p className="text-xs text-slate-400 mt-1">Inicia sesión con una cuenta de administrador</p>
      </div>
    );
  }

  return (
    <div className="px-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <Shield size={20} className="text-colsein-500" /> Usuarios
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{users.filter(u => u.activo).length} activos de {users.length} total</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3.5 py-2.5 bg-colsein-500 text-white rounded-xl text-xs font-semibold hover:bg-colsein-600 transition-colors">
          <UserPlus size={14} /> Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Buscar por nombre, email o cédula..." value={search} onChange={e => setSearch(e.target.value)} className="input-field !pl-9" />
      </div>

      {/* User list */}
      {loading ? (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-colsein-500 rounded-full animate-spin mx-auto mb-2" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(usr => {
            const ri = rolInfo(usr.rol);
            return (
              <div key={usr.id} className={`bg-white rounded-xl p-3.5 border shadow-sm ${usr.activo ? 'border-slate-100' : 'border-red-100 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{usr.nombre}</p>
                    <p className="text-[11px] text-slate-400 truncate">{usr.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ri.color}`}>{ri.label}</span>
                      {usr.zona && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{usr.zona}</span>}
                      {usr.vehiculo_tipo && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{usr.vehiculo_tipo} {usr.placa || ''}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-2">
                    <button onClick={() => openEdit(usr)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Editar">
                      <Pencil size={14} className="text-slate-500" />
                    </button>
                    <button onClick={() => toggleActive(usr)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${usr.activo ? 'bg-emerald-100 hover:bg-red-100' : 'bg-red-100 hover:bg-emerald-100'}`} title={usr.activo ? 'Desactivar' : 'Activar'}>
                      <Power size={14} className={usr.activo ? 'text-emerald-600' : 'text-red-500'} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">No se encontraron usuarios</p>
          )}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-t-[20px] w-full max-w-[480px] max-h-[92vh] overflow-auto p-5 pb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={18} /></button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">{error}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="label-field">Nombre completo *</label>
                <input placeholder="Ej: Juan Carlos Pérez" value={form.nombre} onChange={e => u('nombre', e.target.value)} className="input-field" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-field">Cédula *</label>
                  <input placeholder="Ej: 79627188" value={form.cedula} onChange={e => u('cedula', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Teléfono</label>
                  <input placeholder="Ej: 3001234567" value={form.telefono} onChange={e => u('telefono', e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label className="label-field">Email *</label>
                <input type="email" placeholder="usuario@colsein.co" value={form.email} onChange={e => u('email', e.target.value)} className="input-field" />
              </div>

              <div>
                <label className="label-field">{editingId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder={editingId ? 'Sin cambios' : 'Mínimo 6 caracteres'} value={form.password} onChange={e => u('password', e.target.value)} className="input-field !pr-10" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label-field">Rol *</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => u('rol', r.value)} className={`px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all ${form.rol === r.value ? `${r.color} border-current` : 'border-slate-200 bg-white text-slate-600'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-field">Zona</label>
                  <select value={form.zona} onChange={e => u('zona', e.target.value)} className="input-field">
                    <option value="">Sin zona</option>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Líder Regional</label>
                  <select value={form.lider_regional_id} onChange={e => u('lider_regional_id', e.target.value ? parseInt(e.target.value) : '')} className="input-field">
                    <option value="">Sin asignar</option>
                    {lideres.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>

              {(form.rol === 'comercial' || form.rol === 'lider_regional') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">Vehículo</label>
                    <div className="flex gap-2">
                      {['CARRO', 'MOTO'].map(v => (
                        <button key={v} onClick={() => u('vehiculo_tipo', v)} className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${form.vehiculo_tipo === v ? 'bg-colsein-500 text-white border-colsein-500' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Placa</label>
                    <input placeholder="Ej: ABC123" value={form.placa} onChange={e => u('placa', e.target.value.toUpperCase())} className="input-field" maxLength={7} />
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-5">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
