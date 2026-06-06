export const ORGANIZATION_MODULES = [
  {
    key: 'projects',
    label: 'Projects',
    description: 'Client projects, timelines, and milestones.',
    route: '/projects',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    description: 'Task lists, assignments, and delivery tracking.',
    route: '/tasks',
  },
  {
    key: 'kanban',
    label: 'Kanban',
    description: 'Board-based workflow views for project execution.',
    route: '/kanban',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Clock-in, shift management, and leave operations.',
    route: '/attendance',
  },
  {
    key: 'timeTracking',
    label: 'Time Tracking',
    description: 'Timesheets, active timers, and logged effort.',
    route: '/time-tracking',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Operational and performance reporting.',
    route: '/reports',
  },
  {
    key: 'chat',
    label: 'Chat',
    description: 'Internal team communication and conversations.',
    route: '/chat',
  },
  {
    key: 'clients',
    label: 'Clients',
    description: 'Client directory and relationship management.',
    route: '/clients',
  },
  {
    key: 'team',
    label: 'Team',
    description: 'Employee directory and team structure access.',
    route: '/team',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'In-app alerts and notification center.',
    route: '/notifications',
  },
];

export const DEFAULT_ORGANIZATION_MODULES = Object.freeze(
  ORGANIZATION_MODULES.reduce((acc, moduleDef) => {
    acc[moduleDef.key] = true;
    return acc;
  }, {})
);

export function normalizeOrganizationModules(values) {
  return ORGANIZATION_MODULES.reduce((acc, moduleDef) => {
    acc[moduleDef.key] = values?.[moduleDef.key] !== false;
    return acc;
  }, {});
}

export function resolveOrganizationModuleForPath(pathname = '') {
  const match = ORGANIZATION_MODULES.find(
    (moduleDef) => pathname === moduleDef.route || pathname.startsWith(moduleDef.route + '/')
  );
  return match?.key || null;
}