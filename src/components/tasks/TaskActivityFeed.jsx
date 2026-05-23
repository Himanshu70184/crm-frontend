'use client';

import { useState, useEffect } from 'react';
import { tasksAPI } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

const actionIcons = {
  'Created task': '✨',
  'Updated task': '✏️',
  'Moved task': '↔️',
  'Added comment': '💬',
  'Logged time manually': '⏱️',
  'Logged time via timer': '⏱️',
  'Started time tracker': '▶️',
  'Deleted task': '🗑️',
};

function describeActivity(a) {
  const m = a.metadata || {};
  switch (a.action) {
    case 'Moved task':
      return `moved from ${m.fromLabel || m.from} to ${m.toLabel || m.to}`;
    case 'Created task':
      return `created "${m.title || 'task'}"${m.projectName ? ` in ${m.projectName}` : ''}`;
    case 'Updated task':
      return `updated — ${m.changes || 'details changed'}`;
    case 'Added comment':
      return `commented: "${m.preview || ''}"`;
    case 'Logged time manually':
    case 'Logged time via timer':
      return `logged ${m.hours}h${m.description ? ` — ${m.description}` : ''}`;
    case 'Started time tracker':
      return 'started the timer';
    default:
      return a.action.toLowerCase();
  }
}

export default function TaskActivityFeed({ taskId, refreshKey = 0 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    tasksAPI
      .getActivities(taskId)
      .then((res) => setActivities(res.data.activities || []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [taskId, refreshKey]);

  if (loading) {
    return <p className="text-sm text-surface-400 py-4 text-center">Loading activity…</p>;
  }

  if (!activities.length) {
    return <p className="text-sm text-surface-400 py-6 text-center">No activity yet</p>;
  }

  return (
    <div className="space-y-0 max-h-80 overflow-y-auto">
      {activities.map((a) => (
        <div key={a._id} className="flex gap-3 py-3 border-b border-surface-100 last:border-0">
          <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-sm flex-shrink-0">
            {actionIcons[a.action] || '•'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-surface-800">
              <span className="font-semibold">{a.user?.name || 'User'}</span>
              {' '}
              {describeActivity(a)}
            </p>
            <p className="text-xs text-surface-400 mt-0.5">{formatRelativeTime(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
