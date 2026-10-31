import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService.js';
import { ROLE_DEFINITIONS, ROLES } from '../constants/roles.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Normalize role to lowercase for frontend routing/constants compatibility
  const normalizedRole = useMemo(() => {
    if (!user?.role) return null;
    const r = user.role.toLowerCase();
    return r === 'admin' ? ROLES.ADMIN : r === 'staff' ? ROLES.STAFF : ROLES.CUSTOMER;
  }, [user?.role]);

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await authService.getMe();
      setUser(me);
    } catch (err) {
      console.warn('Failed to restore session:', err?.message);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    const handleLogout = () => {
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [restoreSession]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    try {
      const result = await authService.register({ name, email, password });
      setUser(result.user);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: normalizedRole,
      rawRole: user?.role || null,
      customerId: user?.customerId || null,
      customer: user?.customer || null,
      isAuthenticated: Boolean(user),
      loading,
      login,
      register,
      logout,
      refreshUser: restoreSession,
    }),
    [user, normalizedRole, loading, login, register, logout, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

