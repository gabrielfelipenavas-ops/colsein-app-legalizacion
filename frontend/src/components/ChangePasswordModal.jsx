import { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import useModalA11y from '../utils/useModalA11y';

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const modalRef = useModalA11y(onClose);

  const handleSave = async () => {
    setError('');
    if (!current) return setError('Ingresa tu contraseña actual');
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres');
    if (nueva !== confirmar) return setError('La confirmación no coincide con la nueva contraseña');
    setSaving(true);
    try {
      await authAPI.changePassword(current, nueva);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'No se pudo cambiar la contraseña');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200]" onClick={onClose} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Cambiar contraseña" className="fixed z-[210] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold"><KeyRound size={16} className="text-colsein-500" /> Cambiar contraseña</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 p-1"><X size={22} /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
            <p className="text-sm font-bold text-slate-700">Contraseña actualizada</p>
            <p className="text-xs text-slate-400 mt-1">Usa tu nueva contraseña la próxima vez que ingreses.</p>
            <button onClick={onClose} className="btn-primary w-full mt-4">Listo</button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Contraseña actual</label>
              <input type={show ? 'text' : 'password'} value={current} onChange={e => { setCurrent(e.target.value); setError(''); }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nueva contraseña</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={nueva} onChange={e => { setNueva(e.target.value); setError(''); }}
                  placeholder="Mínimo 8 caracteres" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm pr-10" />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Confirmar nueva contraseña</label>
              <input type={show ? 'text' : 'password'} value={confirmar} onChange={e => { setConfirmar(e.target.value); setError(''); }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
