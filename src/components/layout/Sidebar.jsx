'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { useOrganizationSettings } from '@/context/OrganizationSettingsContext';
import { cn } from '@/lib/utils';
import {
  IconDashboard, IconProjects, IconTasks, IconClock, IconAttendance,
  IconTeam, IconChart, IconClients, IconSettings, IconLogo, IconChat,
} from '@/components/ui/Icons';
import Avatar from '@/components/ui/Avatar';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',    Icon: IconDashboard, roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'team_member', 'member', 'client'] },
  { href: '/projects',      label: 'Projects',     Icon: IconProjects,  moduleKey: 'projects', roles: ['super_admin', 'admin', 'manager', 'team_lead', 'team_member', 'member', 'client'] },
  { href: '/tasks',         label: 'Tasks',        Icon: IconTasks,     moduleKey: 'tasks', roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'team_member', 'member'] },
  { href: '/attendance',    label: 'Attendance',   Icon: IconAttendance, moduleKey: 'attendance', roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'team_member', 'member'] },
  { href: '/time-tracking', label: 'Time Tracking',Icon: IconClock,     moduleKey: 'timeTracking', roles: ['super_admin', 'admin', 'manager', 'team_lead', 'team_member', 'member'] },
  { href: '/reports',       label: 'Reports',      Icon: IconChart,     moduleKey: 'reports', roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead'] },
  { href: '/chat',          label: 'Chat',         Icon: IconChat,      moduleKey: 'chat', roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'team_member', 'member'] },
  { href: '/clients',       label: 'Clients',      Icon: IconClients,   moduleKey: 'clients', roles: ['super_admin', 'admin', 'manager'] },
  { href: '/team',          label: 'Team',         Icon: IconTeam,      moduleKey: 'team', roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead'] },
  { href: '/settings',      label: 'Settings',     Icon: IconSettings,  roles: ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'team_member', 'member'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { branding, companyLogo } = useBranding();
  const { isModuleEnabled } = useOrganizationSettings();
  const visible = navItems.filter(
    (item) => item.roles.includes(user?.role) && (!item.moduleKey || isModuleEnabled(item.moduleKey))
  );

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
          <Avatar
            name={user?.name}
            src={user?.avatar}
            size={9}
            rounded="xl"
            textClassName="text-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
