'use client';

import { useState, useEffect } from 'react';
import { notificationsAPI } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  task_assigned: '📋',
  task_updated: '✏️',
  task_completed: '✅',
  comment_added: '💬',
  mentioned: '🔔',
  project_updated: '📁',
  deadline_reminder: '⏰',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsAPI.getAll({ limit: 50 })
      .then((res) => {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch { toast.error('Failed to mark as read'); }
  };

  const markRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsAPI.remove(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch { toast.error('Failed to delete notification'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-gray-500 text-sm mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">Mark all as read</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600" /></div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-gray-400">No notifications yet</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {notifications.map((n) => (
            <div key={n._id} className={`flex gap-4 p-4 ${!n.read ? 'bg-blue-50/50' : ''}`}>
              <div className="text-2xl flex-shrink-0">{TYPE_ICONS[n.type] || '🔔'}</div>
              <div className="flex-1 min-w-0" onClick={() => !n.read && markRead(n._id)}>
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-xs text-primary-600 hover:underline" onClick={() => markRead(n._id)}>
                      View →
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                <button onClick={() => deleteNotification(n._id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
