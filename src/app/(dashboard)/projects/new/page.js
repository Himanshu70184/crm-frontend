'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { projectsAPI, usersAPI } from '@/lib/api';
import toast from 'react-hot-toast';

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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

  const [selectedTeams, setSelectedTeams] = useState([]);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const teamDropdownRef = useRef(null);
  const memberDropdownRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) {
        setIsTeamDropdownOpen(false);
      }
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const teams = useMemo(() => {
    const unique = [...new Set(users.map((u) => u.department).filter(Boolean))];
    return unique.sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (selectedTeams.length === 0) return users;
    return users.filter((u) => selectedTeams.includes(u.department));
  }, [users, selectedTeams]);

  const handleTeamFilterToggle = (teamName) => {
    setSelectedTeams((prev) => {
      const next = prev.includes(teamName) ? prev.filter((t) => t !== teamName) : [...prev, teamName];
      const allowedIds = next.length === 0
        ? users.map((u) => u._id)
        : users.filter((u) => next.includes(u.department)).map((u) => u._id);
      setForm((f) => ({ ...f, team: f.team.filter((id) => allowedIds.includes(id)) }));
      return next;
    });
  };

  const handleTeamToggle = (userId) => {
    setForm((f) => ({
      ...f,
      team: f.team.includes(userId) ? f.team.filter((id) => id !== userId) : [...f.team, userId],
    }));
  };

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

  const teamDropdownLabel = selectedTeams.length === 0
    ? 'All Teams'
    : `${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} selected`;

  const memberDropdownLabel = form.team.length === 0
    ? 'All Members'
    : `${form.team.length} member${form.team.length > 1 ? 's' : ''} selected`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Project name is required');
    setLoading(true);
    try {
      const data = { ...form, teams: selectedTeams, budget: form.budget ? Number(form.budget) : 0 };
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

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Team Members</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={teamDropdownRef}>
              <label className="label">Team</label>
              <button
                type="button"
                className="input flex items-center justify-between text-left"
                onClick={() => setIsTeamDropdownOpen((open) => !open)}
              >
                <span className={selectedTeams.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
                  {teamDropdownLabel}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTeamDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {teams.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3">No teams found</p>
                  ) : (
                    teams.map((t) => {
                      const checked = selectedTeams.includes(t);
                      return (
                        <label
                          key={t}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                            }`}
                          >
                            {checked && <CheckIcon className="w-3 h-3 text-white" />}
                          </span>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => handleTeamFilterToggle(t)}
                          />
                          <span className="text-sm font-medium text-gray-900 truncate">{t}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={memberDropdownRef}>
              <label className="label">Team Members</label>
              <button
                type="button"
                className="input flex items-center justify-between text-left"
                onClick={() => setIsMemberDropdownOpen((open) => !open)}
              >
                <span className={form.team.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
                  {memberDropdownLabel}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isMemberDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMemberDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3">No members in this team</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const checked = form.team.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                            }`}
                          >
                            {checked && <CheckIcon className="w-3 h-3 text-white" />}
                          </span>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => handleTeamToggle(u._id)}
                          />
                          <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-medium shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{u.department || u.role}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
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