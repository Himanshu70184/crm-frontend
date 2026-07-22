'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsAPI, tasksAPI, usersAPI } from '@/lib/api';
import AddTaskModal from '@/components/tasks/AddTaskModal';
import { formatDate, TASK_STATUSES, PRIORITY_COLORS, PROJECT_STATUS_COLORS } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

function ProjectDescriptionCard({ project, canManage, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setDraft(project.description || '');
  }, [project?.description]);

  const handleSave = async () => {
    if (!project?._id) return;
    const next = draft;
    if ((project.description || '') === next) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await projectsAPI.update(project._id, { description: next });
      onUpdate(res.data.project);
      toast.success('Description updated');
      setEditing(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update description');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(project?.description || '');
    setEditing(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900">Description</h3>
        {canManage && !editing && (
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-primary-600 font-medium"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea
            className="input min-h-[110px] text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a project description…"
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-600 text-sm mt-2 whitespace-pre-wrap">
          {project?.description || 'No description provided.'}
        </p>
      )}
    </div>
  );
}

function ProjectBudgetField({ project, canEdit, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(project?.budget != null ? String(project.budget) : '');
  }, [project?.budget]);

  const handleSave = async () => {
    if (!project?._id) return;
    const nextValue = Number(draft);
    if (draft === '' || Number.isNaN(nextValue) || nextValue < 0) {
      toast.error('Enter a valid budget amount');
      return;
    }
    if (nextValue === (project.budget || 0)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await projectsAPI.update(project._id, { budget: nextValue });
      onUpdate(res.data.project);
      toast.success('Budget updated');
      setEditing(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update budget');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(project?.budget != null ? String(project.budget) : '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex justify-between items-center gap-2">
        <dt className="text-gray-500">Budget</dt>
        <dd className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className="input text-xs w-28 py-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium px-1"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            Cancel
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center">
      <dt className="text-gray-500">Budget</dt>
      <dd className="flex items-center gap-2">
        <span className="font-medium">${project.budget?.toLocaleString() || 0}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-primary-600 font-medium"
          >
            Edit
          </button>
        )}
      </dd>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);

  const canManage = ['super_admin', 'admin', 'manager'].includes(user?.role);
  const canViewBudget = ['super_admin', 'admin'].includes(user?.role);

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      setLoading(true);
      setTasksLoading(true);

      try {
        const pRes = await projectsAPI.getOne(id);
        if (cancelled) return;
        setProject(pRes.data.project);
      } catch (error) {
        if (!cancelled) {
          setProject(null);
          toast.error(error.response?.data?.message || 'Failed to load project');
        }
        return;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      try {
        const tRes = await tasksAPI.getAll({ project: id });
        if (cancelled) return;
        setTasks(tRes.data.tasks || []);
      } catch (error) {
        if (!cancelled) {
          setTasks([]);
          toast.error(error.response?.data?.message || 'Failed to load project tasks');
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await projectsAPI.remove(id);
      toast.success('Project deleted');
      router.push('/projects');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600" /></div>;
  if (!project) return <p className="text-gray-500">Project not found.</p>;

  const statusCounts = TASK_STATUSES.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.status === s.value).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`badge ${PROJECT_STATUS_COLORS[project.status]}`}>{project.status.replace('_', ' ')}</span>
              <span className="text-sm text-gray-500">{formatDate(project.startDate)} → {formatDate(project.endDate)}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link href={`/kanban/${id}`} className="btn-secondary text-sm">🗂️ Kanban</Link>
            <button onClick={handleDeleteProject} className="btn-danger text-sm">Delete</button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Overall Progress</span>
          <span className="text-gray-500">{project.progress}%</span>
        </div>
        <div className="bg-gray-200 rounded-full h-3">
          <div className="bg-primary-600 h-3 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {['overview', 'tasks', 'milestones', 'team'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <ProjectDescriptionCard project={project} canManage={canManage} onUpdate={setProject} />
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Task Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {statusCounts.map((s) => (
                  <div key={s.value} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                {canViewBudget && (
                  <ProjectBudgetField project={project} canEdit={canManage} onUpdate={setProject} />
                )}
                <div className="flex justify-between"><dt className="text-gray-500">Manager</dt><dd className="font-medium">{project.owner?.name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Priority</dt><dd><span className={`badge ${PRIORITY_COLORS[project.priority]}`}>{project.priority}</span></dd></div>
              </dl>
            </div>
            {project.client?.name && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Client</h3>
                <p className="font-medium text-gray-900">{project.client.name}</p>
                <p className="text-sm text-gray-500">{project.client.company}</p>
                <p className="text-sm text-gray-500">{project.client.email}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {tasksLoading ? 'Loading tasks...' : `${tasks.length} tasks`}
            </p>
            {canManage && (
              <button onClick={() => setShowTaskModal(true)} className="btn-primary text-sm">+ Add Task</button>
            )}
          </div>
          <div className="card divide-y divide-gray-100">
            {tasksLoading ? (
              <p className="p-8 text-center text-gray-400">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="p-8 text-center text-gray-400">No tasks yet. Add your first task!</p>
            ) : tasks.map((task) => (
              <Link key={task._id} href={`/tasks/${task._id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                <span className={`badge ${PRIORITY_COLORS[task.priority]} flex-shrink-0`}>{task.priority}</span>
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">{task.title}</span>
                <span className={`badge flex-shrink-0 ${TASK_STATUSES.find((s) => s.value === task.status)?.color}`}>
                  {TASK_STATUSES.find((s) => s.value === task.status)?.label}
                </span>
                {(task.assignees || task.assignee) && (
                  <div className="flex items-center gap-1">
                    {(() => {
                      const assignees = Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : []);
                      if (!assignees.length) return null;
                      const top = assignees.slice(0, 2);
                      return top.map((u, idx) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-medium -ml-1 first:ml-0"
                          title={u.name}
                        >
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                      ));
                    })()}
                    {Array.isArray(task.assignees) && task.assignees.length > 2 && (
                      <span className="text-xs text-gray-500 ml-1">+{task.assignees.length - 2}</span>
                    )}
                  </div>
                )}

                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(task.dueDate)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'milestones' && (
        <MilestonesTab project={project} canManage={canManage} onUpdate={setProject} />
      )}

      {activeTab === 'team' && (
        <ProjectTeamTab project={project} canManage={canManage} onUpdate={setProject} />
      )}

      <AddTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onCreated={(t) => { setTasks((prev) => [t, ...prev]); setShowTaskModal(false); }}
        defaultProjectId={id}
      />
    </div>
  );
}

function ProjectTeamTab({ project, canManage, onUpdate }) {
  const [allUsers, setAllUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersAPI.getAll({ limit: 200 }).then((res) => {
      const list = (res.data.users || []).filter((u) => u.isActive !== false);
      setAllUsers(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setSelected((project.team || []).map((m) => m._id));
  }, [project.team]);

  const toggle = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await projectsAPI.update(project._id, { team: selected });
      onUpdate(res.data.project);
      toast.success('Project team updated');
    } catch {
      toast.error('Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">Project team</h2>
          <p className="text-sm text-gray-500 mt-1">
            Members listed here appear on tasks. All active staff can still be assigned from the task card.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={save} className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save team'}
          </button>
        )}
      </div>
      {canManage ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {allUsers.map((u) => (
            <label
              key={u._id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="rounded text-primary-600"
                checked={selected.includes(u._id)}
                onChange={() => toggle(u._id)}
              />
              <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm">
                {u.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-500 capitalize">{u.role}</p>
              </div>
            </label>
          ))}
          {allUsers.length === 0 && (
            <p className="text-gray-400 col-span-3 py-6 text-center text-sm">
              No users yet. Add users under Team in the sidebar.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.team?.map((member) => (
            <div key={member._id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
                {member.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{member.name}</p>
                <p className="text-sm text-gray-500 capitalize">{member.role}</p>
              </div>
            </div>
          ))}
          {project.team?.length === 0 && (
            <p className="text-gray-400 col-span-3 text-center py-8">No team members on this project.</p>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_BADGE_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

function MilestonesTab({ project, canManage, onUpdate }) {
  const [milestones, setMilestones] = useState(project.milestones || []);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [draft, setDraft] = useState({
    title: '',
    startDate: '',
    endDate: '',
    budget: '',
    taxRate: '',
  });

  // Only resync local milestones when we switch to a *different* project.
  // Watching `project.milestones` directly caused an unrelated parent
  // re-render (e.g. background polling) to silently overwrite in-progress
  // edits — including a just-changed status — before the user could save.
  useEffect(() => {
    setMilestones(project.milestones || []);
    setEditingIndex(null);
    setEditDraft(null);
  }, [project._id]);

  const calcTax = (m) => {
    const budget = Number(m.budget) || 0;
    const rate = Number(m.taxRate) || 0;
    return (budget * rate) / 100;
  };

  const calcTotal = (m) => (Number(m.budget) || 0) - calcTax(m);

  // Persists a full milestone list to the backend and syncs local + parent state
  // from the server's response, so what's on screen always matches what's saved.
  const persist = async (nextMilestones) => {
    setSaving(true);
    try {
      const res = await projectsAPI.updateMilestones(project._id, nextMilestones);
      setMilestones(res.data.milestones);
      onUpdate((p) => ({
        ...p,
        milestones: res.data.milestones,
        revenue: res.data.revenue ?? p.revenue,
      }));
      toast.success('Milestones saved');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save milestones');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const addMilestone = async () => {
    if (!draft.title.trim()) return;
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    const newBudget = Number(draft.budget) || 0;
    const projectBudget = Number(project.budget) || 0;
    const existingTotal = milestones.reduce((sum, m) => sum + (Number(m.budget) || 0), 0);
    const remaining = projectBudget - existingTotal;

    if (newBudget > remaining) {
      toast.error(
        `Milestone budgets can't exceed the project budget ($${projectBudget.toLocaleString()}). Remaining: $${remaining.toLocaleString()}`
      );
      return;
    }

    const next = [
      ...milestones,
      {
        title: draft.title.trim(),
        startDate: draft.startDate || '',
        endDate: draft.endDate || '',
        budget: newBudget,
        taxRate: Number(draft.taxRate) || 0,
        status: 'pending',
      },
    ];

    const ok = await persist(next);
    if (ok) setDraft({ title: '', startDate: '', endDate: '', budget: '', taxRate: '' });
  };

  const startEdit = (i) => {
    setEditingIndex(i);
    setEditDraft({ ...milestones[i] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const updateEditDraft = (field, value) => setEditDraft((d) => ({ ...d, [field]: value }));

  const saveEdit = async (i) => {
    if (editDraft.startDate && editDraft.endDate && editDraft.endDate < editDraft.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    const editedBudget = Number(editDraft.budget) || 0;
    const projectBudget = Number(project.budget) || 0;
    const otherTotal = milestones.reduce(
      (sum, m, j) => (j === i ? sum : sum + (Number(m.budget) || 0)),
      0
    );
    const remaining = projectBudget - otherTotal;

    if (editedBudget > remaining) {
      toast.error(
        `Milestone budgets can't exceed the project budget ($${projectBudget.toLocaleString()}). Remaining for this milestone: $${remaining.toLocaleString()}`
      );
      return;
    }

    const next = milestones.map((m, j) =>
      j === i
        ? {
            ...editDraft,
            budget: editedBudget,
            taxRate: Number(editDraft.taxRate) || 0,
          }
        : m
    );

    const ok = await persist(next);
    if (ok) {
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  const removeMilestone = async (i) => {
    if (!confirm('Remove this milestone?')) return;
    const next = milestones.filter((_, j) => j !== i);
    await persist(next);
  };

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-gray-100">
        {milestones.length === 0 && (
          <p className="p-8 text-center text-gray-400">No milestones yet.</p>
        )}

        {milestones.map((m, i) => {
          const isEditing = editingIndex === i;

          if (!isEditing) {
            // ── View mode: read-only, nothing can change until "Edit" is clicked ──
            return (
              <div key={m._id || i} className="p-4 space-y-2">
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 ">
                   <span className="flex-1 text-2xl capitalize font-bold text-gray-900">{m.title}</span>

                  <span className={`badge ${STATUS_BADGE_COLORS[m.status]}`}>
                    {STATUS_LABELS[m.status] || m.status}
                  </span>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        className="text-xs text-gray-500 hover:text-primary-600 font-medium px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMilestone(i)}
                        className="text-red-500 hover:text-red-700 text-sm px-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Start date</label>
                    <div className="input text-xs w-full bg-gray-50 text-gray-700 flex items-center min-h-[38px]">
                      {m.startDate ? formatDate(m.startDate) : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End date</label>
                    <div className="input text-xs w-full bg-gray-50 text-gray-700 flex items-center min-h-[38px]">
                      {m.endDate ? formatDate(m.endDate) : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Budget ($)</label>
                    <div className="input text-xs w-full bg-gray-50 text-gray-700 flex items-center min-h-[38px]">
                      ${(m.budget || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tax (%)</label>
                    <div className="input text-xs w-full bg-gray-50 text-gray-700 flex items-center min-h-[38px]">
                      {m.taxRate || 0}%
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Tax amount: <span className="font-medium text-gray-800">${calcTax(m).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  {'  •  '}
                  Total (after tax):{' '}
                  <span className="font-medium text-gray-800">
                    ${calcTotal(m).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {m.status === 'completed' && (
                    <span className="ml-2 badge bg-green-100 text-green-700">Reflected in Revenue</span>
                  )}
                </p>
              </div>
            );
          }

          // ── Edit mode: fields unlocked for this row only ──
          return (
            <div key={m._id || i} className="p-4 space-y-3 bg-primary-50/30">
              <div className="flex items-center gap-3">
                <select
                  className="input w-36 text-xs"
                  value={editDraft.status}
                  onChange={(e) => updateEditDraft('status', e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                <input
                  className="input flex-1 text-sm"
                  value={editDraft.title}
                  onChange={(e) => updateEditDraft('title', e.target.value)}
                  placeholder="Milestone name"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Start date</label>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={editDraft.startDate?.split('T')[0] || ''}
                    onChange={(e) => updateEditDraft('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End date</label>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={editDraft.endDate?.split('T')[0] || ''}
                    onChange={(e) => updateEditDraft('endDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Budget ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input text-xs w-full"
                    value={editDraft.budget}
                    onChange={(e) => updateEditDraft('budget', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input text-xs w-full"
                    value={editDraft.taxRate}
                    onChange={(e) => updateEditDraft('taxRate', e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Tax amount: <span className="font-medium text-gray-800">${calcTax(editDraft).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                {'  •  '}
                Total (after tax):{' '}
                <span className="font-medium text-gray-800">
                  ${calcTotal(editDraft).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => saveEdit(i)}
                  disabled={saving}
                  className="btn-primary text-sm"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {canManage && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Add milestone</h4>
            <span className="text-xs text-gray-500">
              Remaining budget:{' '}
              <span className="font-medium text-gray-800">
                ${Math.max(0, (Number(project.budget) || 0) - milestones.reduce((sum, m) => sum + (Number(m.budget) || 0), 0)).toLocaleString()}
              </span>
              {' '}/ ${(Number(project.budget) || 0).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="input sm:col-span-2"
              placeholder="Milestone name"
              value={draft.title}
              onChange={(e) => updateDraft('title', e.target.value)}
            />

            <div>
              <label className="text-xs text-gray-500">Start date</label>
              <input
                type="date"
                className="input w-full"
                value={draft.startDate}
                onChange={(e) => updateDraft('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End date</label>
              <input
                type="date"
                className="input w-full"
                value={draft.endDate}
                onChange={(e) => updateDraft('endDate', e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                placeholder="0.00"
                value={draft.budget}
                onChange={(e) => updateDraft('budget', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tax (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                placeholder="0"
                value={draft.taxRate}
                onChange={(e) => updateDraft('taxRate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={addMilestone} disabled={saving} className="btn-primary">
              {saving ? 'Adding…' : 'Add milestone'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}