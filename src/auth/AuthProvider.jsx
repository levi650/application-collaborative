import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { login as apiLogin } from '../services/api.js';

const AuthContext = createContext(null);

/**
 * AuthProvider – manages user session via sessionStorage (allows different
 * accounts across tabs). Exposes user, role, token, login, logout, loading, error.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setToken(parsed.token);
      }
    } catch { /* ignore corrupt data */ }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(email, password);
      setUser(data.user);
      setToken(data.token);
      sessionStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
      return data;
    } catch (err) {
      const msg = err.body?.error || err.message || 'Erreur de connexion';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setError(null);
    sessionStorage.removeItem('auth');
  }, []);

  const value = useMemo(() => ({
    user,
    role: user?.role ?? null,
    token,
    login,
    logout,
    loading,
    error,
    isAuthenticated: !!user,
  }), [user, token, login, logout, loading, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
