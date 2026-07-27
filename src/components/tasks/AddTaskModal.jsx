'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { tasksAPI, projectsAPI, settingsAPI } from '@/lib/api';
import { fetchAssignableUsers } from '@/lib/assignableUsers';
import { DEFAULT_COLUMNS, getProjectColumns } from '@/lib/kanban';
import toast from 'react-hot-toast';

export default function AddTaskModal({ open, onClose, onCreated, defaultProjectId = '' }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee: '',
    dueDate: '',
    project: defaultProjectId,
    status: 'todo',
  });

  useEffect(() => {
    if (!open) return;
    projectsAPI.getAll({ limit: 100 }).then((res) => setProjects(res.data.projects || [])).catch(() => {});
    settingsAPI.getKanbanColumns()
      .then((res) => setColumns(res.data.columns || DEFAULT_COLUMNS))
      .catch(() => setColumns(DEFAULT_COLUMNS));
    setForm((f) => ({ ...f, project: defaultProjectId || f.project }));
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!form.project) {
      setColumns(DEFAULT_COLUMNS);
      setForm((prev) => ({ ...prev, status: DEFAULT_COLUMNS[0]?.id || 'todo' }));
      return;
    }

    Promise.all([
      projectsAPI.getOne(form.project),
      settingsAPI.getKanbanColumns().catch(() => ({ data: { columns: DEFAULT_COLUMNS } })),
    ])
      .then(([pRes, sRes]) => {
        const fallbackColumns = sRes?.data?.columns || DEFAULT_COLUMNS;
        const nextColumns = getProjectColumns(pRes.data.project, fallbackColumns);
        setColumns(nextColumns);
        setForm((prev) => {
          const hasStatus = nextColumns.some((c) => c.id === prev.status);
          return { ...prev, status: hasStatus ? prev.status : (nextColumns[0]?.id || 'todo') };
        });
      })
      .catch(() => {
        setColumns(DEFAULT_COLUMNS);
        setForm((prev) => ({ ...prev, status: DEFAULT_COLUMNS[0]?.id || 'todo' }));
      });
  }, [form.project]);

  useEffect(() => {
    if (!form.project) {
      setTeam([]);
      return;
    }
    fetchAssignableUsers(form.project).then(setTeam).catch(() => setTeam([]));
  }, [form.project]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project) return toast.error('Select a project');
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.assignee) {
        payload.assignee = String(payload.assignee);
      } else {
        delete payload.assignee;
      }
      if (!payload.dueDate) delete payload.dueDate;
      const res = await tasksAPI.create(payload);
      toast.success('Task created');
      onCreated(res.data.task);
      onClose();
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        assignee: '',
        dueDate: '',
        project: defaultProjectId || '',
        status: columns[0]?.id || 'todo',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-premium-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-surface-900 mb-1">Add Task</h3>
        <p className="text-sm text-surface-500 mb-4">Create a task and assign it to a project phase</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Project *</label>
            <select
              className="input"
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              required
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assignee</label>
              <select className="input" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
