'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { settingsAPI } from '@/lib/api';

export const DEFAULT_BRANDING = {
  appName: 'CRM Pro',
  tagline: 'Project & task management for service teams',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#4f46e5',
  primaryHover: '#4338ca',
  accentColor: '#8b5cf6',
  sidebarBg: '#0f172a',
  authGradientFrom: '#eef2ff',
  authGradientTo: '#e0e7ff',
};

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  companyName: 'CRM Pro',
  companyLogo: '',
  loading: true,
  refresh: () => {},
});

function applyBrandingCss(branding, companyName) {
  const b = { ...DEFAULT_BRANDING, ...branding };
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-primary-hover', b.primaryHover);
  root.style.setProperty('--brand-accent', b.accentColor);
  root.style.setProperty('--brand-sidebar', b.sidebarBg);
  root.style.setProperty('--brand-auth-from', b.authGradientFrom);
  root.style.setProperty('--brand-auth-to', b.authGradientTo);
  document.title = `${b.appName || companyName || 'CRM'} – Project Management`;
  if (b.faviconUrl) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [companyName, setCompanyName] = useState('CRM Pro');
  const [companyLogo, setCompanyLogo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await settingsAPI.getPublic();
      const b = { ...DEFAULT_BRANDING, ...res.data.branding };
      setBranding(b);
      setCompanyName(res.data.companyName || b.appName);
      setCompanyLogo(res.data.companyLogo || b.logoUrl || '');
      applyBrandingCss(b, res.data.companyName);
    } catch {
      applyBrandingCss(DEFAULT_BRANDING, 'CRM Pro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <BrandingContext.Provider value={{ branding, companyName, companyLogo, loading, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
