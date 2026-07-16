import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('colsein_token');
    const stored = sessionStorage.getItem('colsein_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    sessionStorage.setItem('colsein_token', data.token);
    sessionStorage.setItem('colsein_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    sessionStorage.removeItem('colsein_token');
    sessionStorage.removeItem('colsein_user');
    setUser(null);
  };

  // Actualiza campos del usuario en sesión (ej. firma_url tras guardar la firma)
  const updateUser = (fields) => {
    setUser((prev) => {
      const next = { ...prev, ...fields };
      sessionStorage.setItem('colsein_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
