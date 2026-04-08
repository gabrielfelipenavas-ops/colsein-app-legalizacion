import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Home, Route, Camera, FileText, BarChart3, Users, Shield, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const baseTabs = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/km', icon: Route, label: 'Km' },
  { to: '/facturas', icon: Camera, label: 'Facturas' },
  { to: '/viajes', icon: FileText, label: 'Viajes' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
];

const adminTabs = [
  { to: '/usuarios', icon: Shield, label: 'Usuarios', adminOnly: true },
];

export default function AppLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 max-w-[480px] mx-auto relative">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-colsein-500 to-colsein-700 text-white px-5 pt-4 pb-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight">COLSEIN S.A.S.</h1>
            <p className="text-[11px] opacity-70 mt-0.5 font-medium">{user?.nombre} · {user?.rol?.replace('_', ' ')}</p>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center relative">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button onClick={logout} className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-3 pb-24 px-0">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-slate-200 flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
        {[...baseTabs, ...(user?.rol === 'administrador' ? adminTabs : [])].map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-colors ${isActive ? 'text-colsein-500' : 'text-slate-400'}`}>
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-colsein-500 -mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
