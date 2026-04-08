import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import KilometrajePage from './pages/KilometrajePage';
import FacturasPage from './pages/FacturasPage';
import ViajesPage from './pages/ViajesPage';
import LegalizacionPage from './pages/LegalizacionPage';
import ReportesPage from './pages/ReportesPage';
import ClientesPage from './pages/ClientesPage';
import UsuariosPage from './pages/UsuariosPage';
import './index.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-colsein-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Cargando...</p>
      </div>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<HomePage />} />
            <Route path="km" element={<KilometrajePage />} />
            <Route path="facturas" element={<FacturasPage />} />
            <Route path="legalizacion" element={<LegalizacionPage />} />
            <Route path="viajes" element={<ViajesPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
