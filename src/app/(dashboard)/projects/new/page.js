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
    startDate: '', endDate: '',
    client: { name: '', email: '', company: '' },
    budget: '',
  });

  // ─── Team assignment ───────────────────────────────────────────────────────
  // Two independent, direct-assignment controls that feed one payload:
  //   selectedTeams → departments assigned wholesale (all of their members)
  //   manualIds     → individuals picked directly from any department
  //   excludedIds   → members unchecked out of a department that is assigned
  // Effective team sent to the API:
  //   (members of selectedTeams ∪ manualIds) − excludedIds
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [manualIds, setManualIds] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [memberFilterTeams, setMemberFilterTeams] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
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

  // Members that belong to any currently assigned department.
  const teamMemberIds = useMemo(
    () => users.filter((u) => selectedTeams.includes(u.department)).map((u) => u._id),
    [users, selectedTeams]
  );

  // The effective assignment that will be saved on the project.
  const assignedIds = useMemo(() => {
    const set = new Set(teamMemberIds);
    manualIds.forEach((id) => set.add(id));
    excludedIds.forEach((id) => set.delete(id));
    return Array.from(set);
  }, [teamMemberIds, manualIds, excludedIds]);

  // Members listed in the "Add members" dropdown (search + optional dept filter).
  const filteredUsers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (memberFilterTeams.length && !memberFilterTeams.includes(u.department)) return false;
      if (!term) return true;
      return (
        (u.name || '').toLowerCase().includes(term) ||
        (u.department || '').toLowerCase().includes(term) ||
        (u.role || '').toLowerCase().includes(term)
      );
    });
  }, [users, memberFilterTeams, memberSearch]);

  // Directly assign / unassign a whole department (and every member in it).
  const handleTeamToggle = (teamName) => {
    const deptIds = users.filter((u) => u.department === teamName).map((u) => u._id);
    const isSelected = selectedTeams.includes(teamName);

    setSelectedTeams(
      isSelected ? selectedTeams.filter((t) => t !== teamName) : [...selectedTeams, teamName]
    );
    // Re-selecting a team restores anyone individually excluded; deselecting
    // clears those exclusions so a later re-select starts from a clean state.
    setExcludedIds((prev) => prev.filter((id) => !deptIds.includes(id)));
  };

  // Directly assign / unassign a single member from any department.
  const handleMemberToggle = (userId) => {
    const isAssigned = assignedIds.includes(userId);
    const member = users.find((u) => u._id === userId);
    const fromAssignedTeam = Boolean(member && selectedTeams.includes(member.department));

    if (isAssigned) {
      // Remove: drop any individual pick, and remember the exclusion when the
      // person came in via an assigned department.
      setManualIds((prev) => prev.filter((id) => id !== userId));
      if (fromAssignedTeam) {
        setExcludedIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    } else {
      // Add: clear any prior exclusion; otherwise record an individual pick.
      setExcludedIds((prev) => prev.filter((id) => id !== userId));
      if (!fromAssignedTeam) {
        setManualIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    }
  };

  // Per-department assignment state, used to render full / partial checkboxes.
  const getTeamAssignmentState = (teamName) => {
    const ids = users.filter((u) => u.department === teamName).map((u) => u._id);
    if (ids.length === 0) return { state: 'none', selectedCount: 0, total: 0 };
    const selectedCount = ids.filter((id) => assignedIds.includes(id)).length;
    if (selectedCount === 0) return { state: 'none', selectedCount, total: ids.length };
    if (selectedCount === ids.length) return { state: 'all', selectedCount, total: ids.length };
    return { state: 'partial', selectedCount, total: ids.length };
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
    ? 'Assign whole teams'
    : `${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} assigned`;

  const memberDropdownLabel = assignedIds.length === 0
    ? 'Add members'
    : `${assignedIds.length} member${assignedIds.length > 1 ? 's' : ''} assigned`;

  // Departments whose members are only partially assigned (some unchecked).
  const partialTeamNames = selectedTeams.filter(
    (t) => getTeamAssignmentState(t).state === 'partial'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Project name is required');
    setLoading(true);
    try {
      const data = { ...form, team: assignedIds, budget: form.budget ? Number(form.budget) : 0 };
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
              Assign whole teams, individual members, or both — every selection applies directly to the project.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ── Assign whole teams ─────────────────────────────────────── */}
            <div className="relative" ref={teamDropdownRef}>
              <label className="label">Assign team</label>
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
                      const { state, selectedCount, total } = getTeamAssignmentState(t);
                      const fullyAssigned = state === 'all';
                      const partiallyAssigned = state === 'partial';
                      return (
                        <label
                          key={t}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              fullyAssigned
                                ? 'bg-primary-600 border-primary-600'
                                : partiallyAssigned
                                ? 'bg-primary-100 border-primary-400'
                                : 'border-gray-300'
                            }`}
                          >
                            {fullyAssigned && <CheckIcon className="w-3 h-3 text-white" />}
                            {partiallyAssigned && <span className="w-2 h-0.5 bg-primary-600 rounded" />}
                          </span>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={fullyAssigned}
                            onChange={() => handleTeamToggle(t)}
                          />
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">{t}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {selectedCount}/{total}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={memberDropdownRef}>
              <label className="label">Add members</label>
              <button
                type="button"
                className="input flex items-center justify-between text-left"
                onClick={() => setIsMemberDropdownOpen((open) => !open)}
              >
                <span className={assignedIds.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
                  {memberDropdownLabel}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isMemberDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMemberDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100 space-y-2">
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Search members…"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    {teams.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setMemberFilterTeams([])}
                          className={`px-2 py-0.5 rounded-full text-xs border ${
                            memberFilterTeams.length === 0
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          All
                        </button>
                        {teams.map((t) => {
                          const active = memberFilterTeams.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setMemberFilterTeams((prev) =>
                                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                                )
                              }
                              className={`px-2 py-0.5 rounded-full text-xs border ${
                                active
                                  ? 'bg-primary-600 border-primary-600 text-white'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="overflow-y-auto max-h-56">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3">No members found</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const checked = assignedIds.includes(u._id);
                      const fromTeam = selectedTeams.includes(u.department);
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
                            onChange={() => handleMemberToggle(u._id)}
                          />
                          <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-medium shrink-0">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs text-gray-500 capitalize truncate">
                              {u.department || u.role}
                            </p>
                          </div>
                          {fromTeam && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-100 shrink-0">
                              via team
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 border-t border-gray-100 text-sm text-gray-600">
            <span>
              <span className="font-semibold text-gray-900">{assignedIds.length}</span> member
              {assignedIds.length === 1 ? '' : 's'} assigned
            </span>
            {selectedTeams.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span>
                  via{' '}
                  <span className="font-medium text-gray-900">{selectedTeams.join(', ')}</span>
                </span>
              </>
            )}
            {partialTeamNames.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">
                  partially assigned: {partialTeamNames.join(', ')}
                </span>
              </>
            )}
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