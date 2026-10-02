'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { projectsAPI, usersAPI } from '@/lib/api';
import TeamAssignmentField from '@/components/projects/TeamAssignmentField';
import toast from 'react-hot-toast';

export default function NewProjectPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', status: 'planning', priority: 'medium',
    startDate: '', endDate: '',
    client: { name: '', email: '', company: '' },
    budget: '',
  });

  // Team assignment lives in <TeamAssignmentField>; this page only ever holds
  // the final list of user ids to save on the project.
  const [teamIds, setTeamIds] = useState([]);

  // Client dropdown state
  const [clientsList, setClientsList] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  useEffect(() => {
    usersAPI.getAll({ limit: 100 }).then((res) => setUsers(res.data.users)).catch(() => {});
  }, []);

  // Fetch existing clients (role: 'client') for dropdown
  useEffect(() => {
    usersAPI.getAll({ role: 'client', limit: 100 })
      .then((res) => setClientsList(res.data.users || []))
      .catch(() => {});
  }, []);

  // Populate client details from the selected dropdown option
  const handleClientSelect = (id) => {
    setSelectedClientId(id);
    if (!id) {
      setForm((f) => ({ ...f, client: { name: '', email: '', company: '' } }));
      return;
    }
    const c = clientsList.find((u) => u._id === id);
    if (c) {
      setForm((f) => ({
        ...f,
        client: { name: c.name || '', email: c.email || '', company: c.company || '' },
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Project name is required');
    setLoading(true);
    try {
      const data = { ...form, team: teamIds, budget: form.budget ? Number(form.budget) : 0 };
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500 mt-1">
              Assign whole teams, individual members, or both - every selection applies directly to the project.
            </p>
          </div>

          <TeamAssignmentField users={users} onChange={setTeamIds} />
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Client (Optional)</h2>

          <div>
            <label className="label">Select Client</label>
            <select className="input" value={selectedClientId} onChange={(e) => handleClientSelect(e.target.value)}>
              <option value="">Select a Client</option>
              {clientsList.map((c) => (
                <option key={c._id} value={c._id}>{c.name} </option>
              ))}
            </select>
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
