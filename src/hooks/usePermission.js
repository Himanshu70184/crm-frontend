'use client';

import { useAuth } from '@/context/AuthContext';

/**
 * Hook for checking permissions in components.
 *
 * Usage:
 *   const { can, scope } = usePermission('projects', 'create');
 *   if (can) { ... }
 *
 * Or with multiple checks:
 *   const { hasPermission } = usePermission();
 *   hasPermission('tasks', 'delete')
 */
export function usePermission(module, action) {
  const { hasPermission, getDataScope, user } = useAuth();

  if (module && action) {
    return {
      can: hasPermission(module, action),
      scope: getDataScope(module, action),
      hasPermission,
      getDataScope,
      user,
    };
  }

  return { hasPermission, getDataScope, user };
}

export default usePermission;
