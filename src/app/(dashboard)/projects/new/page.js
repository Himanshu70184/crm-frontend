'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { projectsAPI, usersAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function NewProjectPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', status: 'planning', priority: 'medium',
    startDate: '', endDate: '', team: [],
    client: { name: '', email: '', company: '' },
    budget: '',
  });

  useEffect(() => {
    usersAPI.getAll({ limit: 100 }).then((res) => setUsers(res.data.users)).catch(() => {});
  }, []);

  const handleTeamToggle = (userId) => {
    setForm((f) => ({
      ...f,
      team: f.team.includes(userId) ? f.team.filter((id) => id !== userId) : [...f.team, userId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Project name is required');
    setLoading(true);
    try {
      const data = { ...form, budget: form.budget ? Number(form.budget) : 0 };
      const res = await projectsAPI.create(data);
      toast.success('Project created!');
      router.push(`/projects/${res.data.project._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Project</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in the details to create a new project</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Project Details</h2>
          <div>
            <label className="label">Project Name *</label>
            <input className="input" placeholder="e.g. E-Commerce Platform" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} placeholder="What is this project about?"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Budget ($)</label>
            <input className="input" type="number" placeholder="0" value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
        </div>

        {/* Team */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Team Members</h2>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {users.map((u) => (
              <label key={u._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="rounded" checked={form.team.includes(u._id)}
                  onChange={() => handleTeamToggle(u._id)} />
                <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-medium">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Client */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Client Details (Optional)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client Name</label>
              <input className="input" placeholder="John Smith" value={form.client.name}
                onChange={(e) => setForm({ ...form, client: { ...form.client, name: e.target.value } })} />
            </div>
            <div>
              <label className="label">Client Email</label>
              <input className="input" type="email" placeholder="client@company.com" value={form.client.email}
                onChange={(e) => setForm({ ...form, client: { ...form.client, email: e.target.value } })} />
            </div>
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" placeholder="Acme Corp" value={form.client.company}
              onChange={(e) => setForm({ ...form, client: { ...form.client, company: e.target.value } })} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
