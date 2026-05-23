'use client';

import { useBranding } from '@/context/BrandingContext';

export default function AuthLayout({ children }) {
  const { branding, companyLogo } = useBranding();

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: `linear-gradient(135deg, var(--brand-auth-from) 0%, #f8fafc 50%, var(--brand-auth-to) 100%)`,
      }}
    >
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-12 flex-col justify-between"
        style={{ backgroundColor: 'var(--brand-sidebar)' }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
        />
        <div className="relative flex items-center gap-3">
          {companyLogo || branding.logoUrl ? (
            <img src={companyLogo || branding.logoUrl} alt="" className="w-11 h-11 rounded-2xl object-cover" />
          ) : (
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
          <span className="text-xl font-bold text-white">{branding.appName}</span>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">{branding.tagline}</h2>
          <p className="text-white/60 text-lg max-w-md">
            Kanban, time tracking, client portals, and team analytics — built for service organizations.
          </p>
        </div>
        <p className="relative text-white/30 text-xs">© {branding.appName}</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            {companyLogo || branding.logoUrl ? (
              <img src={companyLogo || branding.logoUrl} alt="" className="w-12 h-12 rounded-2xl mx-auto mb-3 object-cover" />
            ) : (
              <div
                className="inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}
            <h1 className="text-2xl font-bold text-surface-900">{branding.appName}</h1>
          </div>
          <div className="card p-8 sm:p-10 shadow-premium-lg">{children}</div>
        </div>
      </div>
    </div>
  );
}
