'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { settingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_ORGANIZATION_MODULES,
  normalizeOrganizationModules,
} from '@/lib/organizationModules';

const OrganizationSettingsContext = createContext(null);

export function OrganizationSettingsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [moduleSettings, setModuleSettings] = useState(DEFAULT_ORGANIZATION_MODULES);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setModuleSettings(DEFAULT_ORGANIZATION_MODULES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await settingsAPI.get();
      setModuleSettings(normalizeOrganizationModules(res.data?.settings?.organizationModules));
    } catch {
      setModuleSettings(DEFAULT_ORGANIZATION_MODULES);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const isModuleEnabled = useCallback(
    (moduleKey) => {
      if (!moduleKey) return true;
      return moduleSettings?.[moduleKey] !== false;
    },
    [moduleSettings]
  );

  return (
    <OrganizationSettingsContext.Provider
      value={{
        moduleSettings,
        loading: authLoading || loading,
        refresh: load,
        isModuleEnabled,
      }}
    >
      {children}
    </OrganizationSettingsContext.Provider>
  );
}

export function useOrganizationSettings() {
  const context = useContext(OrganizationSettingsContext);
  if (!context) {
    throw new Error('useOrganizationSettings must be used within OrganizationSettingsProvider');
  }
  return context;
}