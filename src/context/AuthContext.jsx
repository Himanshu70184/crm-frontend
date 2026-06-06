'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('crm_user');
    const token = localStorage.getItem('crm_token');
    if (storedUser && token) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      if (parsed.permissions) setPermissions(parsed.permissions);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token, user } = res.data;
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(user));
    setUser(user);
    setPermissions(user.permissions || null);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
    setPermissions(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    if (updatedUser.permissions) setPermissions(updatedUser.permissions);
    localStorage.setItem('crm_user', JSON.stringify(updatedUser));
  };

  /**
   * Check if the current user has permission for a given module + action.
   * super_admin always returns true.
   * Falls back gracefully when permissions haven't loaded yet.
   */
  const hasPermission = useCallback(
    (module, action) => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      // Admin: legacy check
      if (user.role === 'admin') return true;
      if (!permissions) return false;
      return permissions?.[module]?.[action]?.enabled === true;
    },
    [user, permissions]
  );

  /**
   * Get the data scope for a module+action.
   * Returns 'organization' for super_admin/admin, otherwise from permissions.
   */
  const getDataScope = useCallback(
    (module, action) => {
      if (!user) return 'own';
      if (user.role === 'super_admin' || user.role === 'admin') return 'organization';
      return permissions?.[module]?.[action]?.dataScope || 'own';
    },
    [user, permissions]
  );

  /** Convenience: true if user has at least one of the provided roles */
  const hasRole = useCallback(
    (...roles) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, updateUser, hasPermission, getDataScope, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
