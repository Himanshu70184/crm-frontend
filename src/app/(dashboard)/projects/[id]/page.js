'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsAPI, tasksAPI, usersAPI } from '@/lib/api';
import AddTaskModal from '@/components/tasks/AddTaskModal';
import { formatDate, TASK_STATUSES, PRIORITY_COLORS, PROJECT_STATUS_COLORS } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

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
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 text-sm">{project.description || 'No description provided.'}</p>
            </div>
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
                  <div className="flex justify-between"><dt className="text-gray-500">Budget</dt><dd className="font-medium">${project.budget?.toLocaleString() || 0}</dd></div>
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
                {task.assignee && (
                  <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-medium" title={task.assignee.name}>
                    {task.assignee.name?.charAt(0).toUpperCase()}
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

function MilestonesTab({ project, canManage, onUpdate }) {
  const [milestones, setMilestones] = useState(project.milestones || []);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const addMilestone = () => {
    if (!newTitle.trim()) return;
    setMilestones([...milestones, { title: newTitle, status: 'pending', dueDate: '' }]);
    setNewTitle('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await projectsAPI.updateMilestones(project._id, milestones);
      onUpdate((p) => ({ ...p, milestones: res.data.milestones }));
      toast.success('Milestones saved');
    } catch { toast.error('Failed to save milestones'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-gray-100">
        {milestones.length === 0 && <p className="p-8 text-center text-gray-400">No milestones yet.</p>}
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <select className="input w-36 text-xs" value={m.status}
              onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <span className="flex-1 text-sm font-medium text-gray-900">{m.title}</span>
            <input type="date" className="input w-36 text-xs" value={m.dueDate?.split('T')[0] || ''}
              onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} />
            {canManage && (
              <button onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-sm px-2">✕</button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="New milestone title…" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMilestone()} />
          <button onClick={addMilestone} className="btn-secondary">Add</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </div>
  );
}