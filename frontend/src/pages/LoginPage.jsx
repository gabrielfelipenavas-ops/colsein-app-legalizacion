import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-colsein-500 via-colsein-700 to-colsein-900 px-6 pt-16 pb-10 text-center text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-5 -left-8 w-28 h-28 rounded-full bg-white/[0.03]" />
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl font-extrabold text-colsein-500">C</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">COLSEIN S.A.S.</h1>
        <p className="text-[11px] opacity-70 mt-1 tracking-[3px] uppercase font-medium">Medición · Control · Automatización</p>
        <p className="text-base font-semibold mt-5 opacity-90">Sistema de Gestión de Gastos</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 -mt-4">
        <div className="card max-w-sm mx-auto">
          <h2 className="text-lg font-bold text-center mb-6">Iniciar Sesión</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="label-field">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu.nombre@colsein.co" className="input-field" autoFocus required />
            </div>
            <div className="mb-4">
              <label className="label-field">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Ingresa tu contraseña" className="input-field pl-10 pr-11" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-600">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock size={17} />
              )}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Cuentas de prueba:</p>
            {[
              { e: 'esteban.meza@colsein.co', p: 'meza2026', r: 'Comercial' },
              { e: 'carlos.ramirez@colsein.co', p: 'ramirez2026', r: 'Líder' },
              { e: 'biviana.baez@colsein.co', p: 'admin2026', r: 'Admin' },
            ].map((u) => (
              <button key={u.e} type="button" onClick={() => { setEmail(u.e); setPassword(u.p); }} className="w-full text-left p-2 hover:bg-white rounded-lg transition-colors mb-1 group">
                <span className="text-xs font-mono text-colsein-600 group-hover:underline">{u.e}</span>
                <span className="text-[10px] text-slate-400 ml-2">({u.r})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
