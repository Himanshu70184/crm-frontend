export const COLUMN_COLORS = {
  slate: { header: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700', ring: 'ring-slate-300' },
  indigo: { header: 'bg-indigo-500', badge: 'bg-primary-100 text-primary-700', ring: 'ring-primary-300' },
  amber: { header: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800', ring: 'ring-amber-300' },
  emerald: { header: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-300' },
  red: { header: 'bg-red-500', badge: 'bg-red-100 text-red-700', ring: 'ring-red-300' },
  violet: { header: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800', ring: 'ring-violet-300' },
  cyan: { header: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-800', ring: 'ring-cyan-300' },
  orange: { header: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800', ring: 'ring-orange-300' },
};

export const COLOR_OPTIONS = Object.keys(COLUMN_COLORS);

export function getColumnStyle(color) {
  return COLUMN_COLORS[color] || COLUMN_COLORS.slate;
}

export function slugifyColumnId(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `phase_${Date.now()}`;
}

export const DEFAULT_COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'slate', order: 0, wipLimit: null },
  { id: 'in_progress', label: 'In Progress', color: 'indigo', order: 1, wipLimit: 5 },
  { id: 'in_review', label: 'In Review', color: 'amber', order: 2, wipLimit: 3 },
  { id: 'completed', label: 'Completed', color: 'emerald', order: 3, wipLimit: null },
  { id: 'blocked', label: 'Blocked', color: 'red', order: 4, wipLimit: 2 },
];

/** @deprecated use columns from API */
export const TASK_STATUSES = DEFAULT_COLUMNS.map((c) => ({
  value: c.id,
  label: c.label,
  color: getColumnStyle(c.color).badge,
  dot: getColumnStyle(c.color).header,
}));

export function getStatusMeta(columns, statusId) {
  const col = columns.find((c) => c.id === statusId);
  if (!col) return { label: statusId, color: COLUMN_COLORS.slate.badge };
  return { label: col.label, color: getColumnStyle(col.color).badge };
}

export function getProjectColumns(project, fallback = DEFAULT_COLUMNS) {
  const cols = project?.kanbanConfig?.columns;
  return Array.isArray(cols) && cols.length ? cols : fallback;
}
