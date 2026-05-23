'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { notificationsAPI } from '@/lib/api';
import { IconBell } from '@/components/ui/Icons';

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/time-tracking': 'Time Tracking',
  '/reports': 'Reports & Analytics',
  '/clients': 'Clients',
  '/team': 'Team',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    notificationsAPI.getAll({ unread: true, limit: 1 })
      .then((res) => setUnread(res.data.unreadCount))
      .catch(() => {});
  }, [pathname]);

  const title = Object.entries(routeTitles).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] || 'CRM Pro';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 glass-nav flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h2 className="text-lg font-bold text-surface-900">{title}</h2>
        <p className="text-xs text-surface-500">Hello, {user?.name?.split(' ')[0]}</p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className="relative p-2.5 text-surface-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
        >
          <IconBell />
          {unread > 0 && (
            <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-surface-100 transition-colors border border-transparent hover:border-surface-200"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-surface-700 hidden sm:block">{user?.name}</span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-premium-lg border border-surface-200 z-50 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100">
                  <p className="text-sm font-semibold text-surface-900">{user?.name}</p>
                  <p className="text-xs text-surface-500 capitalize">{user?.role}</p>
                </div>
                <Link href="/settings" className="block px-4 py-2.5 text-sm text-surface-700 hover:bg-primary-50 hover:text-primary-700" onClick={() => setShowUserMenu(false)}>
                  Profile & Settings
                </Link>
                <button type="button" onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
