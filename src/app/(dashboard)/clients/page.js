'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usersAPI, projectsAPI } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { ROLE_COLORS, PROJECT_STATUS_COLORS, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      usersAPI.getAll({ role: 'client' }),
      projectsAPI.getAll({ limit: 100 }),
    ])
      .then(([uRes, pRes]) => {
        setClients(uRes.data.users || []);
        setProjects(pRes.data.projects || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const projectsForClient = (email) =>
    projects.filter((p) => p.client?.email === email);

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      return toast.error('Name and email are required');
    }
    setSaving(true);
    try {
      await usersAPI.create({ ...form, role: 'client' });
      toast.success('Client added!');
      setForm({ name: '', email: '', company: '', phone: '' });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Clients"
          subtitle="Client accounts and linked projects for your service organization"
        />
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clients.length ? clients.map((client) => {
          const linked = projectsForClient(client.email);
          return (
            <div key={client._id} className="card-hover p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                  {client.name?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-surface-900 truncate">{client.name}</h3>
                  <p className="text-sm text-surface-500 truncate">{client.email}</p>
                  <span className={`badge mt-2 ${ROLE_COLORS.client}`}>Client</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-100">
                <p className="text-xs font-semibold text-surface-500 uppercase mb-2">
                  Projects ({linked.length})
                </p>
                {linked.length ? (
                  <ul className="space-y-2">
                    {linked.map((p) => (
                      <li key={p._id}>
                        <Link href={`/projects/${p._id}`} className="flex items-center justify-between text-sm hover:text-primary-600 group">
                          <span className="font-medium text-surface-800 group-hover:text-primary-700 truncate">{p.name}</span>
                          <span className={`badge ml-2 ${PROJECT_STATUS_COLORS[p.status]}`}>{p.status}</span>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-surface-400">{p.progress}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-surface-400">No linked projects</p>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full card p-12 text-center text-surface-500">
            No client users yet. Register users with the Client role or run <code className="text-primary-600">npm run seed</code> in backend.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-surface-900">Add Client</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-surface-600">✕</button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Company</label>
                <input className="input" value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Adding…' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}