'use client';

import { useState, useEffect } from 'react';
import { projectsAPI, usersAPI } from '@/lib/api';
import TeamAssignmentField from '@/components/projects/TeamAssignmentField';
import toast from 'react-hot-toast';

/** Date -> value for <input type="date">, using local parts (not toISOString,
 *  which shifts the day backwards for timezones ahead of UTC). */
function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const EMPTY_CLIENT = { name: '', email: '', company: '' };

export default function EditProjectModal({ open, project, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    startDate: '',
    endDate: '',
    budget: '',
    client: EMPTY_CLIENT,
  });
  const [teamIds, setTeamIds] = useState([]);

  // Only meaningful while the modal is open.
  const projectId = open && project ? project._id : null;

  useEffect(() => {
    if (!open) return;
    usersAPI
      .getAll({ limit: 200 })
      .then((res) => setUsers((res.data.users || []).filter((u) => u.isActive !== false)))
      .catch(() => setUsers([]));
  }, [open]);

  // Prefill every input from the project currently being edited.
  useEffect(() => {
    if (!open || !project) return;
    setForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'planning',
      priority: project.priority || 'medium',
      startDate: toDateInputValue(project.startDate),
      endDate: toDateInputValue(project.endDate),
      budget: project.budget ? String(project.budget) : '',
      client: {
        name: project.client?.name || '',
        email: project.client?.email || '',
        company: project.client?.company || '',
      },
    });
    setTeamIds((project.team || []).map((m) => m._id));
  }, [open, project?._id]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setClientField = (key, value) =>
    setForm((f) => ({ ...f, client: { ...f.client, [key]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');

    setSaving(true);
    try {
      const res = await projectsAPI.update(project._id, {
        name: form.name.trim(),
        description: form.description,
        status: form.status,
        priority: form.priority,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        budget: form.budget ? Number(form.budget) : 0,
        client: {
          name: form.client.name || '',
          email: form.client.email || '',
          company: form.client.company || '',
        },
        team: teamIds,
      });
      toast.success('Project updated');
      onSaved?.(res.data.project);
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !project) return null;

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center bg-surface-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-3xl p-6 shadow-premium-lg my-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Project</h2>
            <p className="text-sm text-gray-500 mt-1">Update the details for this project.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 -mr-2 -mt-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="label">Project Name *</label>
              <input className="input" value={form.name}
                onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} placeholder="What is this project about?"
                value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input className="input" type="date" value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input className="input" type="date" value={form.endDate}
                  onChange={(e) => setField('endDate', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Budget ($)</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.budget}
                onChange={(e) => setField('budget', e.target.value)} />
            </div>
          </div>
  <div className="space-y-3 pt-4 border-t border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900">Team Members</h3>
              <p className="text-sm text-gray-500 mt-1">
                Only members listed here can see this project on their dashboard.
              </p>
            </div>
            <TeamAssignmentField
              users={users}
              initialIds={teamIds}
              resetKey={projectId || 'none'}
              onChange={setTeamIds}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900">Client (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Client name</label>
                <input className="input" value={form.client.name}
                  onChange={(e) => setClientField('name', e.target.value)} />
              </div>
              <div>
                <label className="label">Client email</label>
                <input className="input" type="email" value={form.client.email}
                  onChange={(e) => setClientField('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Company</label>
                <input className="input" value={form.client.company}
                  onChange={(e) => setClientField('company', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}