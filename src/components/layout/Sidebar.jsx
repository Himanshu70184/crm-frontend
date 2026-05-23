'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { cn } from '@/lib/utils';
import {
  IconDashboard, IconProjects, IconTasks, IconClock,
  IconTeam, IconChart, IconClients, IconSettings, IconLogo,
} from '@/components/ui/Icons';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard, roles: ['admin', 'manager', 'member', 'client'] },
  { href: '/projects', label: 'Projects', Icon: IconProjects, roles: ['admin', 'manager', 'member', 'client'] },
  { href: '/tasks', label: 'Tasks', Icon: IconTasks, roles: ['admin', 'manager', 'member'] },
  { href: '/time-tracking', label: 'Time Tracking', Icon: IconClock, roles: ['admin', 'manager', 'member'] },
  { href: '/reports', label: 'Reports', Icon: IconChart, roles: ['admin', 'manager'] },
  { href: '/clients', label: 'Clients', Icon: IconClients, roles: ['admin', 'manager'] },
  { href: '/team', label: 'Team', Icon: IconTeam, roles: ['admin', 'manager'] },
  { href: '/settings', label: 'Settings', Icon: IconSettings, roles: ['admin', 'manager', 'member'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { branding, companyLogo } = useBranding();
  const visible = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <aside className="w-64 bg-brand-sidebar flex flex-col flex-shrink-0" style={{ backgroundColor: 'var(--brand-sidebar)' }}>
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          {companyLogo || branding.logoUrl ? (
            <img src={companyLogo || branding.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
            >
              <IconLogo className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <span className="font-bold text-white text-sm tracking-tight block truncate">{branding.appName}</span>
            <p className="text-[10px] text-white/40 truncate">{branding.tagline?.slice(0, 28)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Menu</p>
        {visible.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? 'text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
              style={active ? { backgroundColor: 'var(--brand-primary)' } : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
