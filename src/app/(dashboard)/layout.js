'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOrganizationSettings } from '@/context/OrganizationSettingsContext';
import { resolveOrganizationModuleForPath } from '@/lib/organizationModules';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const { isModuleEnabled, loading: settingsLoading } = useOrganizationSettings();
  const router = useRouter();
  const pathname = usePathname();
  const currentModule = resolveOrganizationModuleForPath(pathname);
  const moduleBlocked = currentModule && !isModuleEnabled(currentModule);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || (user && settingsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return null;

  if (moduleBlocked) {
    const manageHref = ['super_admin', 'admin'].includes(user.role) ? '/settings' : '/dashboard';
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto card p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl font-bold">
                !
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-surface-900">Module disabled</h2>
                <p className="text-surface-500">
                  This feature is currently turned off for your organization.
                </p>
              </div>
              <Link href={manageHref} className="btn-primary inline-block">
                {manageHref === '/settings' ? 'Manage organization modules' : 'Back to dashboard'}
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
