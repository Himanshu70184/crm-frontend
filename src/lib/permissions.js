/**
 * Frontend mirror of backend/src/utils/permissions.js
 * Single source of truth for modules and actions displayed in the UI.
 */

export const MODULES = [
  { key: 'employees',     label: 'Employees',       group: 'HR' },
  { key: 'attendance',    label: 'Attendance',       group: 'HR' },
  { key: 'leave',         label: 'Leave Management', group: 'HR' },
  { key: 'payroll',       label: 'Payroll',          group: 'HR' },
  { key: 'recruitment',   label: 'Recruitment',      group: 'HR' },
  { key: 'performance',   label: 'Performance',      group: 'HR' },
  { key: 'projects',      label: 'Projects',         group: 'Operations' },
  { key: 'tasks',         label: 'Tasks',            group: 'Operations' },
  { key: 'teams',         label: 'Teams',            group: 'Operations' },
  { key: 'clients',       label: 'Clients',          group: 'Operations' },
  { key: 'meetings',      label: 'Meetings',         group: 'Operations' },
  { key: 'tickets',       label: 'Tickets',          group: 'Operations' },
  { key: 'reports',       label: 'Reports',          group: 'Analytics' },
  { key: 'assets',        label: 'Assets',           group: 'Resources' },
  { key: 'documents',     label: 'Documents',        group: 'Resources' },
  { key: 'announcements', label: 'Announcements',    group: 'Communication' },
  { key: 'chat',          label: 'Chat',             group: 'Communication' },
  { key: 'settings',      label: 'Settings',         group: 'Administration' },
];

export const ACTIONS = [
  { key: 'create',          label: 'Create',          shortLabel: 'CR' },
  { key: 'read',            label: 'Read',            shortLabel: 'RD' },
  { key: 'update',          label: 'Update',          shortLabel: 'UP' },
  { key: 'delete',          label: 'Delete',          shortLabel: 'DL' },
  { key: 'approve',         label: 'Approve',         shortLabel: 'AP' },
  { key: 'assign',          label: 'Assign',          shortLabel: 'AS' },
  { key: 'export',          label: 'Export',          shortLabel: 'EX' },
  { key: 'import',          label: 'Import',          shortLabel: 'IM' },
  { key: 'manage_settings', label: 'Settings',        shortLabel: 'ST' },
];

export const DATA_SCOPES = [
  { key: 'own',          label: 'Own Data Only' },
  { key: 'team',         label: 'Team Data' },
  { key: 'department',   label: 'Department Data' },
  { key: 'organization', label: 'Organization Wide' },
  { key: 'custom',       label: 'Custom Assigned' },
];

/** Build fully-disabled permissions object for a new role */
export function buildDefaultPermissions() {
  const perms = {};
  for (const mod of MODULES) {
    perms[mod.key] = {};
    for (const action of ACTIONS) {
      perms[mod.key][action.key] = { enabled: false, dataScope: 'own' };
    }
  }
  return perms;
}

/** Group modules by their group key */
export function getModuleGroups() {
  const groups = {};
  for (const mod of MODULES) {
    if (!groups[mod.group]) groups[mod.group] = [];
    groups[mod.group].push(mod);
  }
  return groups;
}
