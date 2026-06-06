'use client';

import { useAuth } from '@/context/AuthContext';

/**
 * Conditionally renders children based on permission.
 *
 * <PermissionGate module="projects" action="create">
 *   <CreateButton />
 * </PermissionGate>
 *
 * Optional `fallback` prop renders alternative UI when access is denied.
 * Optional `requireAdmin` prop renders only for admin/super_admin.
 */
export default function PermissionGate({ module, action, requireAdmin, fallback = null, children }) {
  const { hasPermission, user } = useAuth();

  if (requireAdmin) {
    if (!user || !['super_admin', 'admin'].includes(user.role)) return fallback;
    return children;
  }

  if (module && action) {
    if (!hasPermission(module, action)) return fallback;
  }

  return children;
}
