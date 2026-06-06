'use client';

import { useState, useEffect } from 'react';
import { usersAPI } from '@/lib/api';
import { settingsAPI } from '@/lib/api';
import { ROLE_COLORS, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function TeamPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [shiftOptions, setShiftOptions] = useState([]);

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await usersAPI.getAll(params);
      setUsers(res.data.users);
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  };

  const fetchShiftOptions = async () => {
    try {
      const res = await settingsAPI.get();
      const shifts = res?.data?.settings?.attendance?.shifts || [];
      setShiftOptions(shifts);
    } catch {
      setShiftOptions([]);
    }
  };

  useEffect(() => { fetchUsers(); }, [search, roleFilter]);
  useEffect(() => { fetchShiftOptions(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await usersAPI.remove(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success('User deleted');
    } catch { toast.error('Failed to delete user'); }
  };

  const handleToggleActive = async (u) => {
    try {
      await usersAPI.update(u._id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, isActive: !x.isActive } : x));
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
    } catch { toast.error('Failed to update user'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} members</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn-primary">
            + Add Member
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input w-56" placeholder="Search members…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-40" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="hr">HR</option>
          <option value="manager">Manager</option>
          <option value="team_lead">Team Lead</option>
          <option value="team_member">Team Member</option>
          <option value="client">Client</option>
        </select>
      </div>

      {/* Users grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((u) => (
            <div key={u._id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full bg-primary-600 text-white text-lg flex items-center justify-center font-bold">
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <span className={`badge ${ROLE_COLORS[u.role]}`}>{u.role}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{u.name}</h3>
              <p className="text-sm text-gray-500 truncate">{u.email}</p>
              {u.department && <p className="text-xs text-gray-400 mt-1">{u.department}</p>}
              {u.shiftCode && <p className="text-xs text-indigo-500 mt-1">Shift: {u.shiftCode}</p>}

              <div className="flex items-center justify-between mt-4">
                <span className={`text-xs px-2 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditUser(u); setShowModal(true); }}
                      className="text-xs text-gray-500 hover:text-primary-600 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
                    <button onClick={() => handleToggleActive(u)}
                      className="text-xs text-gray-500 hover:text-yellow-600 px-2 py-1 rounded hover:bg-gray-100">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(u._id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">Del</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <UserModal
          user={editUser}
          shiftOptions={shiftOptions}
          onClose={() => setShowModal(false)}
          onSaved={(u) => {
            if (editUser) setUsers((prev) => prev.map((x) => x._id === u._id ? u : x));
            else setUsers((prev) => [u, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user: editUser, shiftOptions, onClose, onSaved }) {
  const [form, setForm] = useState(
    editUser
      ? {
        name: editUser.name,
        role: editUser.role,
        department: editUser.department || '',
        phone: editUser.phone || '',
        shiftCode: editUser.shiftCode || '',
      }
      : { name: '', email: '', password: '', role: 'member', department: '', phone: '', shiftCode: '' }
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (editUser) res = await usersAPI.update(editUser._id, form);
      else res = await usersAPI.create(form);
      toast.success(editUser ? 'User updated' : 'User created');
      onSaved(res.data.user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{editUser ? 'Edit User' : 'Add Member'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          {!editUser && <>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
          </>}
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
              <option value="manager">Manager</option>
              <option value="team_lead">Team Lead</option>
              <option value="team_member">Team Member</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div><label className="label">Department</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <label className="label">Shift</label>
            <select className="input" value={form.shiftCode || ''} onChange={(e) => setForm({ ...form, shiftCode: e.target.value })}>
              <option value="">Default</option>
              {(shiftOptions || []).map((shift) => (
                <option key={shift.code} value={shift.code}>{shift.name} ({shift.code})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
