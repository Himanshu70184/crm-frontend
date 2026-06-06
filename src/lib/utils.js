export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export { TASK_STATUSES, DEFAULT_COLUMNS, getStatusMeta } from './kanban';

export const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export const PROJECT_STATUS_COLORS = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const ROLE_COLORS = {
  super_admin: 'bg-red-100 text-red-700',
  admin:       'bg-purple-100 text-purple-700',
  hr:          'bg-cyan-100 text-cyan-700',
  manager:     'bg-blue-100 text-blue-700',
  team_lead:   'bg-emerald-100 text-emerald-700',
  team_member: 'bg-gray-100 text-gray-700',
  // legacy aliases
  member:  'bg-gray-100 text-gray-700',
  client:  'bg-orange-100 text-orange-700',
};

export function getInitials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && true;
}
