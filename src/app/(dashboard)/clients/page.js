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
  const [editClient, setEditClient] = useState(null);
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

  const openAddModal = () => {
    setEditClient(null);
    setForm({ name: '', email: '', company: '', phone: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditClient(client);
    setForm({
      name: client.name || '',
      email: client.email || '',
      company: client.company || '',
      phone: client.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      return toast.error('Name and email are required');
    }
    setSaving(true);
    try {
      if (editClient) {
        const res = await usersAPI.update(editClient._id, form);
        const updated = res?.data?.user;
        setClients((prev) => prev.map((c) => (c._id === editClient._id ? { ...c, ...(updated || form) } : c)));
        toast.success('Client updated!');
      } else {
        await usersAPI.create({ ...form, role: 'client' });
        toast.success('Client added!');
        fetchData();
      }
      setForm({ name: '', email: '', company: '', phone: '' });
      setEditClient(null);
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (client) => {
    try {
      await usersAPI.update(client._id, { isActive: !client.isActive });
      setClients((prev) => prev.map((c) => c._id === client._id ? { ...c, isActive: !c.isActive } : c));
      toast.success(client.isActive ? 'Client deactivated' : 'Client activated');
    } catch { toast.error('Failed to update client'); }
  };

  const handleDelete = async (client) => {
    if (!confirm(`Delete client "${client.name}"?`)) return;
    try {
      await usersAPI.remove(client._id);
      setClients((prev) => prev.filter((c) => c._id !== client._id));
      toast.success('Client deleted');
    } catch { toast.error('Failed to delete client'); }
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
        <button className="btn-primary" onClick={openAddModal}>
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
                <div className="flex justify-between flex-1 ">
                  <div>
                  <h3 className="font-semibold text-surface-900 truncate">{client.name}</h3>
                  <a href={`mailto:${client.email}`} className="text-sm text-surface-500 truncate hover:text-primary-600 hover:underline block">{client.email}</a>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${ROLE_COLORS.client}`}>Client</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${client.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {client.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  </div>
                  <div>
                  {client.company && <p className="text-xs text-surface-400 truncate">{client.company}</p>}
                  {client.phone && <p className="text-xs text-surface-400 truncate">{client.phone}</p>}
                  </div>
                  
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3">
                <button onClick={() => openEditModal(client)}
                  className="text-xs text-surface-500 hover:text-primary-600 px-2 py-1 rounded hover:bg-surface-100">Edit</button>
                <button onClick={() => handleToggleActive(client)}
                  className="text-xs text-surface-500 hover:text-yellow-600 px-2 py-1 rounded hover:bg-surface-100">
                  {client.isActive !== false ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(client)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">Del</button>
                {linked.length > 0 && (
                  <Link
                    href={`/projects?client=${encodeURIComponent(client.name)}`}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 ml-auto"
                  >
                    View Project{linked.length > 1 ? 's' : ''} ({linked.length})
                  </Link>
                )}
              </div>

              {/* <div className="mt-4 pt-4 border-t border-surface-100">
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
              </div> */}
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
              <h2 className="font-semibold text-lg text-surface-900">{editClient ? 'Edit Client' : 'Add Client'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditClient(null); }} className="text-surface-400 hover:text-surface-600">✕</button>
            </div>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={Boolean(editClient)} required />
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
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditClient(null); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}