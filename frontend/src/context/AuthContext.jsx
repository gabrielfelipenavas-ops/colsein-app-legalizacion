import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('colsein_token');
    const stored = sessionStorage.getItem('colsein_user');
    if (!token || !stored) {
      setLoading(false);
      return;
    }
    // Mostrar la sesión guardada de inmediato, pero validar el token contra el
    // servidor: si expiró o el usuario fue desactivado, se cierra la sesión.
    try {
      setUser(JSON.parse(stored));
    } catch {}
    authAPI.me()
      .then(({ data }) => {
        setUser(data.user);
        sessionStorage.setItem('colsein_user', JSON.stringify(data.user));
      })
      .catch(() => {
        // El interceptor 401 de api.js ya limpia la sesión y redirige al login.
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    sessionStorage.setItem('colsein_token', data.token);
    sessionStorage.setItem('colsein_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    authAPI.logout().catch(() => {}); // limpia la cookie de acceso a archivos
    sessionStorage.removeItem('colsein_token');
    sessionStorage.removeItem('colsein_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
