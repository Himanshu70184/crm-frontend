'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { rolesAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';

const ROLE_DOT_COLORS = {
  '#dc2626': 'Super Admin',
  '#7c3aed': 'Admin',
  '#0891b2': 'HR',
  '#2563eb': 'Manager',
  '#059669': 'Team Lead',
  '#64748b': 'Team Member',
};

export default function RolesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showClone, setShowClone] = useState(null); // role object to clone
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', color: '#6366f1', hierarchy: 99 });
  const [cloneForm, setCloneForm] = useState({ name: '', displayName: '' });
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' | 'audit'
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await rolesAPI.getAll({ includeInactive: true });
      setRoles(res.data.roles);
    } catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await rolesAPI.getAuditLogs({ limit: 50 });
      setAuditLogs(res.data.logs);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setAuditLoading(false); }
  };

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { if (activeTab === 'audit') fetchAudit(); }, [activeTab]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.displayName.trim()) {
      return toast.error('Name and display name are required');
    }
    setCreating(true);
    try {
      const res = await rolesAPI.create(form);
      setRoles((prev) => [...prev, { ...res.data.role, userCount: 0 }]);
      setShowCreate(false);
      setForm({ name: '', displayName: '', description: '', color: '#6366f1', hierarchy: 99 });
      toast.success('Role created');
      router.push(`/settings/roles/${res.data.role._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create role');
    } finally { setCreating(false); }
  };

  const handleClone = async (e) => {
    e.preventDefault();
    if (!cloneForm.name || !cloneForm.displayName) return toast.error('Name and display name required');
    setCreating(true);
    try {
      const res = await rolesAPI.clone(showClone._id, cloneForm);
      setRoles((prev) => [...prev, { ...res.data.role, userCount: 0 }]);
      setShowClone(null);
      setCloneForm({ name: '', displayName: '' });
      toast.success('Role cloned successfully');
      router.push(`/settings/roles/${res.data.role._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clone role');
    } finally { setCreating(false); }
  };

  const handleDelete = async (role) => {
    if (role.isSystem) return toast.error('System roles cannot be deleted');
    if (role.userCount > 0) return toast.error(`Reassign ${role.userCount} user(s) before deleting`);
    if (!confirm(`Delete role "${role.displayName}"? This cannot be undone.`)) return;
    try {
      await rolesAPI.remove(role._id);
      setRoles((prev) => prev.filter((r) => r._id !== role._id));
      toast.success('Role deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleToggleActive = async (role) => {
    try {
      const res = await rolesAPI.update(role._id, { isActive: !role.isActive });
      setRoles((prev) => prev.map((r) => r._id === role._id ? res.data.role : r));
      toast.success(role.isActive ? 'Role deactivated' : 'Role activated');
    } catch { toast.error('Failed to update role'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Permission Management"
        subtitle="Define roles and control access to every module"
        action={
          isAdmin && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Create Role
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {['roles', 'audit'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === t
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'audit' ? 'Audit Logs' : 'Roles'}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--brand-primary)]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => (
                <RoleCard
                  key={role._id}
                  role={role}
                  isAdmin={isAdmin}
                  onEdit={() => router.push(`/settings/roles/${role._id}`)}
                  onClone={() => { setShowClone(role); setCloneForm({ name: '', displayName: role.displayName + ' (Copy)' }); }}
                  onDelete={() => handleDelete(role)}
                  onToggleActive={() => handleToggleActive(role)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'audit' && (
        <AuditLogsTab logs={auditLogs} loading={auditLoading} />
      )}

      {/* Create Role Modal */}
      {showCreate && (
        <Modal title="Create New Role" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Role Name (slug)</label>
                <input
                  className="input"
                  placeholder="e.g. sales_manager"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Lowercase, underscores only</p>
              </div>
              <div>
                <label className="label">Display Name</label>
                <input
                  className="input"
                  placeholder="e.g. Sales Manager"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={2}
                placeholder="What does this role do?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Badge Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                  />
                  <span className="text-sm text-gray-500">{form.color}</span>
                </div>
              </div>
              <div>
                <label className="label">Hierarchy Level</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={99}
                  value={form.hierarchy}
                  onChange={(e) => setForm({ ...form, hierarchy: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-400 mt-1">Lower = higher authority</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Creating…' : 'Create & Configure Permissions'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Clone Role Modal */}
      {showClone && (
        <Modal title={`Clone: ${showClone.displayName}`} onClose={() => setShowClone(null)}>
          <form onSubmit={handleClone} className="space-y-4">
            <div>
              <label className="label">New Role Name (slug)</label>
              <input
                className="input"
                placeholder="e.g. senior_manager"
                value={cloneForm.name}
                onChange={(e) => setCloneForm({ ...cloneForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                required
              />
            </div>
            <div>
              <label className="label">Display Name</label>
              <input
                className="input"
                value={cloneForm.displayName}
                onChange={(e) => setCloneForm({ ...cloneForm, displayName: e.target.value })}
                required
              />
            </div>
            <p className="text-sm text-gray-500">All permissions from <strong>{showClone.displayName}</strong> will be copied.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowClone(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Cloning…' : 'Clone Role'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RoleCard({ role, isAdmin, onEdit, onClone, onDelete, onToggleActive }) {
  return (
    <div className={`card p-5 space-y-4 ${!role.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
            style={{ backgroundColor: role.color || '#6366f1' }}>
            {role.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{role.displayName}</h3>
              {role.isSystem && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">SYSTEM</span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-mono">{role.name}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${role.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {role.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {role.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{role.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {role.userCount ?? 0} users
        </span>
        <span>Level {role.hierarchy}</span>
      </div>

      {isAdmin && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button onClick={onEdit} className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--brand-primary)] text-white hover:opacity-90 font-medium transition">
            Edit Permissions
          </button>
          <button onClick={onClone} className="px-3 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition" title="Clone">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {!role.isSystem && (
            <>
              <button onClick={onToggleActive} className="px-3 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition" title={role.isActive ? 'Deactivate' : 'Activate'}>
                {role.isActive ? '⏸' : '▶'}
              </button>
              <button onClick={onDelete} disabled={role.userCount > 0} className="px-3 text-xs py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition" title="Delete">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AuditLogsTab({ logs, loading }) {
  const ACTION_LABELS = {
    role_created: { label: 'Role Created', color: 'bg-green-100 text-green-700' },
    role_updated: { label: 'Role Updated', color: 'bg-blue-100 text-blue-700' },
    role_deleted: { label: 'Role Deleted', color: 'bg-red-100 text-red-700' },
    role_cloned: { label: 'Role Cloned', color: 'bg-purple-100 text-purple-700' },
    permissions_updated: { label: 'Permissions Updated', color: 'bg-yellow-100 text-yellow-700' },
    role_activated: { label: 'Activated', color: 'bg-green-100 text-green-700' },
    role_deactivated: { label: 'Deactivated', color: 'bg-gray-100 text-gray-600' },
    user_role_changed: { label: 'User Role Changed', color: 'bg-orange-100 text-orange-700' },
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--brand-primary)]" /></div>;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Action', 'Role', 'Performed By', 'Description', 'Date'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.length === 0 && (
            <tr><td colSpan={5} className="text-center py-10 text-gray-400">No audit logs yet</td></tr>
          )}
          {logs.map((log) => {
            const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600' };
            return (
              <tr key={log._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{log.targetRole?.displayName || '—'}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{log.performedBy?.name}</div>
                  <div className="text-xs text-gray-400">{log.performedBy?.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{log.description}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
