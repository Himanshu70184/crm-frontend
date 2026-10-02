'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

const Chevron = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Check = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Split a flat list of assigned user ids into (fully-assigned departments,
 * individual picks). Departments where every active member is assigned are
 * represented as whole-team selections; anything else stays an individual pick.
 */
export function deriveAssignment(users, assignedIds = []) {
  const set = new Set(assignedIds);
  const teams = [];
  const manual = [];
  const departments = new Set();

  users.forEach((u) => {
    if (u.department) departments.add(u.department);
    else if (set.has(u._id)) manual.push(u._id);
  });

  departments.forEach((dept) => {
    const ids = users.filter((u) => u.department === dept).map((u) => u._id);
    if (ids.length && ids.every((id) => set.has(id))) teams.push(dept);
    else manual.push(...ids.filter((id) => set.has(id)));
  });

  return { teams, manual };
}

export default function TeamAssignmentField({ users, initialIds = [], resetKey = 0, onChange }) {
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [manualIds, setManualIds] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [filterTeams, setFilterTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const teamRef = useRef(null);
  const memberRef = useRef(null);
  const appliedKey = useRef(null);
  const lastSent = useRef(null);

  const teams = useMemo(
    () => [...new Set(users.map((u) => u.department).filter(Boolean))].sort(),
    [users]
  );

  // Effective assignment: (members of assigned teams ∪ individual picks) − exclusions
  const assignedIds = useMemo(() => {
    const set = new Set(
      users.filter((u) => selectedTeams.includes(u.department)).map((u) => u._id)
    );
    manualIds.forEach((id) => set.add(id));
    excludedIds.forEach((id) => set.delete(id));
    return Array.from(set);
  }, [users, selectedTeams, manualIds, excludedIds]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterTeams.length && !filterTeams.includes(u.department)) return false;
      if (!term) return true;
      return [u.name, u.department, u.role].some((f) =>
        (f || '').toLowerCase().includes(term)
      );
    });
  }, [users, filterTeams, search]);

  const teamState = (name) => {
    const ids = users.filter((u) => u.department === name).map((u) => u._id);
    if (!ids.length) return { state: 'none', selectedCount: 0, total: 0 };
    const n = ids.filter((id) => assignedIds.includes(id)).length;
    return {
      state: n === 0 ? 'none' : n === ids.length ? 'all' : 'partial',
      selectedCount: n,
      total: ids.length,
    };
  };

  const toggleTeam = (name) => {
    const deptIds = users.filter((u) => u.department === name).map((u) => u._id);
    const on = selectedTeams.includes(name);
    setSelectedTeams(on ? selectedTeams.filter((t) => t !== name) : [...selectedTeams, name]);
    // Re-selecting a team restores anyone individually excluded from it.
    setExcludedIds((prev) => prev.filter((id) => !deptIds.includes(id)));
  };

  const toggleMember = (id) => {
    const on = assignedIds.includes(id);
    const member = users.find((u) => u._id === id);
    const viaTeam = Boolean(member && selectedTeams.includes(member.department));
    if (on) {
      setManualIds((prev) => prev.filter((x) => x !== id));
      if (viaTeam) setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setExcludedIds((prev) => prev.filter((x) => x !== id));
      if (!viaTeam) setManualIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  // Re-derive the split each time the caller opens the field for a new project.
  useEffect(() => {
    if (!users.length || appliedKey.current === resetKey) return;
    appliedKey.current = resetKey;
    const derived = deriveAssignment(users, initialIds);
    setSelectedTeams(derived.teams);
    setManualIds(derived.manual);
    setExcludedIds([]);
  }, [resetKey, users, initialIds]);

  // Report the final id list upward, but only when it genuinely changes.
  useEffect(() => {
    const key = assignedIds.join(',');
    if (lastSent.current === null) {
      lastSent.current = key;
      return;
    }
    if (lastSent.current === key) return;
    lastSent.current = key;
    onChange?.(assignedIds);
  }, [assignedIds, onChange]);

  useEffect(() => {
    const onAway = (e) => {
      if (teamRef.current && !teamRef.current.contains(e.target)) setTeamOpen(false);
      if (memberRef.current && !memberRef.current.contains(e.target)) setMemberOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, []);

  const partialTeams = selectedTeams.filter((t) => teamState(t).state === 'partial');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Assign whole teams */}
        <div className="relative" ref={teamRef}>
          <label className="label">Assign team</label>
          <button
            type="button"
            className="input flex items-center justify-between text-left"
            onClick={() => setTeamOpen((o) => !o)}
          >
            <span className={selectedTeams.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
              {selectedTeams.length === 0
                ? 'Assign whole teams'
                : `${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} assigned`}
            </span>
            <Chevron className={`w-4 h-4 text-gray-400 transition-transform ${teamOpen ? 'rotate-180' : ''}`} />
          </button>

          {teamOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {teams.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">No teams found</p>
              ) : (
                teams.map((t) => {
                  const { state, selectedCount, total } = teamState(t);
                  const all = state === 'all';
                  const partial = state === 'partial';
                  return (
                    <label
                      key={t}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          all
                            ? 'bg-primary-600 border-primary-600'
                            : partial
                            ? 'bg-primary-100 border-primary-400'
                            : 'border-gray-300'
                        }`}
                      >
                        {all && <Check className="w-3 h-3 text-white" />}
                        {partial && <span className="w-2 h-0.5 bg-primary-600 rounded" />}
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={all}
                        onChange={() => toggleTeam(t)}
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

        {/* Add individual members */}
        <div className="relative" ref={memberRef}>
          <label className="label">Add members</label>
          <button
            type="button"
            className="input flex items-center justify-between text-left"
            onClick={() => setMemberOpen((o) => !o)}
          >
            <span className={assignedIds.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
              {assignedIds.length === 0
                ? 'Add members'
                : `${assignedIds.length} member${assignedIds.length > 1 ? 's' : ''} assigned`}
            </span>
            <Chevron className={`w-4 h-4 text-gray-400 transition-transform ${memberOpen ? 'rotate-180' : ''}`} />
          </button>

          {memberOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-gray-100 space-y-2">
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Search members…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {teams.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setFilterTeams([])}
                      className={`px-2 py-0.5 rounded-full text-xs border ${
                        filterTeams.length === 0
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All
                    </button>
                    {teams.map((t) => {
                      const active = filterTeams.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setFilterTeams((prev) =>
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
                    const viaTeam = selectedTeams.includes(u.department);
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
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => toggleMember(u._id)}
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
                        {viaTeam && (
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

<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
        <span>
          <span className="font-semibold text-gray-900">{assignedIds.length}</span> member
          {assignedIds.length === 1 ? '' : 's'} assigned
        </span>
        {selectedTeams.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span>
              via <span className="font-medium text-gray-900">{selectedTeams.join(', ')}</span>
            </span>
          </>
        )}
        {partialTeams.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-amber-600">partially assigned: {partialTeams.join(', ')}</span>
          </>
        )}
      </div>
    </div>
  );
}