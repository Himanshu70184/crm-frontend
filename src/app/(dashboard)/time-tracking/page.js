'use client';

import { useState, useEffect } from 'react';
import { timeLogsAPI, tasksAPI, projectsAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ project: '', startDate: '', endDate: '' });
  const [form, setForm] = useState({
    task: '', project: '', hours: '', date: new Date().toISOString().split('T')[0], description: '', billable: true,
  });
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    Promise.all([
      projectsAPI.getAll({ limit: 100 }),
      tasksAPI.getAll({ limit: 200 }),
    ]).then(([pRes, tRes]) => {
      setProjects(pRes.data.projects);
      setTasks(tRes.data.tasks);
    }).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filters.project) params.project = filters.project;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await timeLogsAPI.getAll(params);
      setLogs(res.data.logs);
      setTotalHours(res.data.totalHours);
    } catch { toast.error('Failed to load time logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [filters]);

  const handleProjectChange = (projectId) => {
    setForm({ ...form, project: projectId, task: '' });
  };

  const projectTasks = tasks.filter((t) => t.project?._id === form.project || t.project === form.project);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.task || !form.hours) return toast.error('Task and hours are required');
    try {
      const res = await timeLogsAPI.create({ ...form, hours: Number(form.hours) });
      setLogs((prev) => [res.data.log, ...prev]);
      setTotalHours((h) => h + Number(form.hours));
      setForm({ task: '', project: '', hours: '', date: new Date().toISOString().split('T')[0], description: '', billable: true });
      setShowForm(false);
      toast.success('Hours logged!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to log hours'); }
  };

  const handleDelete = async (id, hours) => {
    if (!confirm('Delete this time log?')) return;
    try {
      await timeLogsAPI.remove(id);
      setLogs((prev) => prev.filter((l) => l._id !== id));
      setTotalHours((h) => h - hours);
      toast.success('Log deleted');
    } catch { toast.error('Failed to delete log'); }
  };

  // Group by date
  const grouped = logs.reduce((acc, log) => {
    const date = formatDate(log.date);
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">Total: <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</span> logged</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Log Time</button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Log Time</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Project *</label>
              <select className="input" value={form.project} onChange={(e) => handleProjectChange(e.target.value)} required>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Task *</label>
              <select className="input" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} required>
                <option value="">Select task</option>
                {projectTasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hours *</label>
              <input className="input" type="number" step="0.5" min="0.5" max="24" value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })} required placeholder="e.g. 2.5" />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What did you work on?" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} className="rounded" />
                Billable hours
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Log Time</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input w-48" value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <input className="input w-36" type="date" value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        <span className="flex items-center text-gray-400 text-sm">to</span>
        <input className="input w-36" type="date" value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        {(filters.project || filters.startDate || filters.endDate) && (
          <button onClick={() => setFilters({ project: '', startDate: '', endDate: '' })} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
        )}
      </div>

      {/* Logs grouped by date */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">No time logs found</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-medium text-gray-900 text-sm">{date}</span>
                <span className="text-sm text-gray-500">{dateLogs.reduce((s, l) => s + l.hours, 0).toFixed(1)}h</span>
              </div>
              <div className="divide-y divide-gray-50">
                {dateLogs.map((log) => (
                  <div key={log._id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{log.task?.title}</p>
                      <p className="text-xs text-gray-500">{log.project?.name}{log.description ? ` · ${log.description}` : ''}</p>
                    </div>
                    {!log.billable && <span className="badge bg-gray-100 text-gray-500 text-xs">Non-billable</span>}
                    <span className="font-semibold text-gray-900 text-sm w-16 text-right">{log.hours}h</span>
                    {(user?.role === 'admin' || log.user?._id === user?._id) && (
                      <button onClick={() => handleDelete(log._id, log.hours)} className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
