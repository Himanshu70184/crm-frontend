'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { rolesAPI } from '@/lib/api';
import { MODULES, ACTIONS, DATA_SCOPES, getModuleGroups, buildDefaultPermissions } from '@/lib/permissions';
import toast from 'react-hot-toast';

export default function RoleEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState(buildDefaultPermissions());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');

  const moduleGroups = useMemo(() => getModuleGroups(), []);
  const groupKeys = ['all', ...Object.keys(moduleGroups)];

  const filteredModules = useMemo(() => {
    let list = MODULES;
    if (activeGroup !== 'all') list = list.filter((m) => m.group === activeGroup);
    if (search.trim()) list = list.filter((m) => m.label.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [activeGroup, search]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await rolesAPI.getOne(id);
        const r = res.data.role;
        setRole(r);
        // Merge fetched permissions with defaults to fill any missing modules/actions
        const merged = buildDefaultPermissions();
        for (const mod of MODULES) {
          for (const action of ACTIONS) {
            const fetched = r.permissions?.[mod.key]?.[action.key];
            if (fetched) merged[mod.key][action.key] = fetched;
          }
        }
        setPermissions(merged);
      } catch {
        toast.error('Failed to load role');
        router.push('/settings/roles');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ── Checkbox handlers ────────────────────────────────────────────────────────

  const toggleCell = (modKey, actionKey) => {
    if (!isAdmin) return;
    setPermissions((prev) => ({
      ...prev,
      [modKey]: {
        ...prev[modKey],
        [actionKey]: {
          ...prev[modKey][actionKey],
          enabled: !prev[modKey][actionKey].enabled,
        },
      },
    }));
  };

  // Select all actions for a module (row)
  const toggleModuleAll = (modKey) => {
    const allEnabled = ACTIONS.every((a) => permissions[modKey]?.[a.key]?.enabled);
    setPermissions((prev) => ({
      ...prev,
      [modKey]: Object.fromEntries(
        ACTIONS.map((a) => [a.key, { ...prev[modKey][a.key], enabled: !allEnabled }])
      ),
    }));
  };

  // Select all modules for an action (column)
  const toggleActionAll = (actionKey) => {
    const allEnabled = filteredModules.every((m) => permissions[m.key]?.[actionKey]?.enabled);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const mod of filteredModules) {
        next[mod.key] = { ...next[mod.key], [actionKey]: { ...next[mod.key][actionKey], enabled: !allEnabled } };
      }
      return next;
    });
  };

  // Toggle ALL permissions (full select all / deselect all)
  const toggleAllPermissions = () => {
    const anyEnabled = MODULES.some((m) => ACTIONS.some((a) => permissions[m.key]?.[a.key]?.enabled));
    setPermissions((prev) => {
      const next = {};
      for (const mod of MODULES) {
        next[mod.key] = {};
        for (const action of ACTIONS) {
          next[mod.key][action.key] = { ...prev[mod.key][action.key], enabled: !anyEnabled };
        }
      }
      return next;
    });
  };

  // Set data scope for a module (applies to all actions in that module)
  const setModuleDataScope = (modKey, scope) => {
    setPermissions((prev) => ({
      ...prev,
      [modKey]: Object.fromEntries(
        ACTIONS.map((a) => [a.key, { ...prev[modKey][a.key], dataScope: scope }])
      ),
    }));
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await rolesAPI.update(id, { permissions });
      toast.success('Permissions saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeta = async (updates) => {
    try {
      const res = await rolesAPI.update(id, updates);
      setRole(res.data.role);
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[var(--brand-primary)]" />
      </div>
    );
  }

  const enabledCount = MODULES.reduce(
    (sum, m) => sum + ACTIONS.filter((a) => permissions[m.key]?.[a.key]?.enabled).length,
    0
  );
  const totalCount = MODULES.length * ACTIONS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/settings/roles')} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow"
                style={{ backgroundColor: role?.color || '#6366f1' }}>
                {role?.displayName?.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{role?.displayName}</h1>
                <p className="text-sm text-gray-400 font-mono">{role?.name}</p>
              </div>
              {role?.isSystem && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">SYSTEM</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{enabledCount}</span> / {totalCount} permissions enabled
          </span>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          )}
        </div>
      </div>

      {/* Role meta edit (non-system) */}
      {isAdmin && !role?.isSystem && (
        <RoleMetaEditor role={role} onSave={handleSaveMeta} />
      )}

      {/* Filters */}
      <div className="flex items-center flex-wrap gap-3">
        <input
          className="input w-56"
          placeholder="Search modules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          {groupKeys.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                activeGroup === g
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            onClick={toggleAllPermissions}
            className="ml-auto text-xs text-[var(--brand-primary)] hover:underline font-medium"
          >
            {MODULES.some((m) => ACTIONS.some((a) => permissions[m.key]?.[a.key]?.enabled))
              ? 'Deselect All'
              : 'Select All'}
          </button>
        )}
      </div>

      {/* Permission Matrix */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left font-semibold text-gray-700 min-w-[180px] border-r border-gray-200">
                Module
              </th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[80px] border-r border-gray-100">
                Scope
              </th>
              {/* Row select-all column */}
              <th className="px-3 py-3 text-center min-w-[56px]">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">All</span>
                  <span className="text-[9px] text-gray-300">row</span>
                </div>
              </th>
              {ACTIONS.map((action) => (
                <th key={action.key} className="px-2 py-3 text-center min-w-[56px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide" title={action.label}>
                      {action.shortLabel}
                    </span>
                    {isAdmin && (
                      <MatrixCheckbox
                        checked={filteredModules.every((m) => permissions[m.key]?.[action.key]?.enabled)}
                        onClick={() => toggleActionAll(action.key)}
                        title={`Toggle all: ${action.label}`}
                        size="sm"
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Legend row */}
            <tr className="bg-gray-50/50">
              <td colSpan={3 + ACTIONS.length} className="px-4 py-1.5 border-b border-gray-100">
                <div className="flex gap-4 text-xs text-gray-400">
                  {ACTIONS.map((a) => (
                    <span key={a.key}><span className="font-mono bg-gray-100 px-1 rounded">{a.shortLabel}</span> = {a.label}</span>
                  ))}
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {/* Group the filtered modules */}
            {filteredModules.map((mod, idx) => {
              const prevGroup = idx > 0 ? filteredModules[idx - 1].group : null;
              const showGroupHeader = mod.group !== prevGroup;
              const rowAllEnabled = ACTIONS.every((a) => permissions[mod.key]?.[a.key]?.enabled);
              const modScope = permissions[mod.key]?.[ACTIONS[0].key]?.dataScope || 'own';

              return [
                showGroupHeader && (
                  <tr key={`group-${mod.group}`}>
                    <td colSpan={3 + ACTIONS.length} className="px-4 py-2 bg-gray-50/80 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-y border-gray-100">
                      {mod.group}
                    </td>
                  </tr>
                ),
                <tr key={mod.key} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group">
                  {/* Module name */}
                  <td className="sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 px-4 py-3 font-medium text-gray-800 border-r border-gray-200 transition-colors">
                    {mod.label}
                  </td>
                  {/* Data Scope */}
                  <td className="px-2 py-3 border-r border-gray-100">
                    <select
                      disabled={!isAdmin}
                      value={modScope}
                      onChange={(e) => setModuleDataScope(mod.key, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-[var(--brand-primary)] disabled:bg-transparent disabled:border-transparent disabled:text-gray-400 w-full"
                    >
                      {DATA_SCOPES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Row Select All */}
                  <td className="px-2 py-3 text-center">
                    {isAdmin && (
                      <MatrixCheckbox
                        checked={rowAllEnabled}
                        onClick={() => toggleModuleAll(mod.key)}
                        title={`Toggle all for ${mod.label}`}
                        size="sm"
                      />
                    )}
                  </td>
                  {/* Action cells */}
                  {ACTIONS.map((action) => {
                    const perm = permissions[mod.key]?.[action.key];
                    const enabled = perm?.enabled || false;
                    return (
                      <td key={action.key} className="px-2 py-3 text-center">
                        <MatrixCheckbox
                          checked={enabled}
                          disabled={!isAdmin}
                          onClick={() => toggleCell(mod.key, action.key)}
                          title={`${action.label} - ${mod.label}`}
                        />
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Permission summary */}
      <PermissionSummary permissions={permissions} />

      {/* Save bar */}
      {isAdmin && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 -mx-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{enabledCount}</span> of {totalCount} permissions enabled for <strong>{role?.displayName}</strong>
          </p>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  );
}

function MatrixCheckbox({ checked, onClick, disabled = false, title = '', size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`${sizeClass} rounded-xl border flex items-center justify-center mx-auto transition-all duration-150 ${
        checked
          ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] shadow-[0_6px_16px_rgba(79,70,229,0.28)]'
          : 'bg-white border-gray-200 hover:border-[var(--brand-primary)] hover:bg-blue-50/40'
      } ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer active:scale-[0.96]'}`}
    >
      {checked ? (
        <svg className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className={`${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-gray-300`} />
      )}
    </button>
  );
}

function RoleMetaEditor({ role, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: role.displayName, description: role.description || '', color: role.color || '#6366f1' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="card px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
          <span className="text-sm text-gray-600">{role.description || 'No description'}</span>
        </div>
        <button onClick={() => setEditing(true)} className="btn-secondary text-xs py-1.5">Edit Details</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card px-5 py-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Display Name</label>
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        </div>
        <div className="col-span-1">
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
            <span className="text-sm text-gray-500">{form.color}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function PermissionSummary({ permissions }) {
  const byModule = MODULES.map((mod) => {
    const enabled = ACTIONS.filter((a) => permissions[mod.key]?.[a.key]?.enabled);
    return { ...mod, enabled };
  }).filter((m) => m.enabled.length > 0);

  if (byModule.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No permissions enabled. Check checkboxes above to grant access.
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Active Permissions Summary</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {byModule.map((mod) => (
          <div key={mod.key} className="bg-gray-50 rounded-xl p-3">
            <div className="font-medium text-gray-800 text-sm mb-2">{mod.label}</div>
            <div className="flex flex-wrap gap-1">
              {mod.enabled.map((a) => (
                <span key={a.key} className="text-[10px] bg-[var(--brand-primary)] text-white px-1.5 py-0.5 rounded font-medium">
                  {a.shortLabel}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-2">
              Scope: {permissions[mod.key]?.[mod.enabled[0]?.key]?.dataScope || 'own'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
