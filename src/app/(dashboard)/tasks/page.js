'use client';

import { useState, useEffect, useCallback } from 'react';
import { tasksAPI, projectsAPI, settingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_COLUMNS } from '@/lib/kanban';
import PageHeader from '@/components/ui/PageHeader';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import KanbanPhasesModal from '@/components/kanban/KanbanPhasesModal';
import AddTaskModal from '@/components/tasks/AddTaskModal';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const { user } = useAuth();
  const canManagePhases = ['admin', 'manager'].includes(user?.role);
  const canAddTask = ['admin', 'manager', 'member'].includes(user?.role);

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPhases, setShowPhases] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [filters, setFilters] = useState({ priority: '', project: '', search: '' });

  const loadColumns = useCallback(() => {
    settingsAPI
      .getKanbanColumns()
      .then((res) => setColumns(res.data.columns))
      .catch(() => setColumns(DEFAULT_COLUMNS));
  }, []);

  const loadTasks = useCallback(() => {
    setLoading(true);
    const params = { limit: 500 };
    if (filters.priority) params.priority = filters.priority;
    if (filters.project) params.project = filters.project;
    if (filters.search) params.search = filters.search;

    tasksAPI
      .getAll(params)
      .then((res) => setTasks(res.data.tasks))
      .catch(() => toast.error('Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadColumns();
    projectsAPI.getAll({ limit: 100 }).then((res) => setProjects(res.data.projects)).catch(() => {});
  }, [loadColumns]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleMoveTask = async (taskId, status) => {
    try {
      await tasksAPI.updateStatus(taskId, status);
      const col = columns.find((c) => c.id === status);
      toast.success(`Moved to ${col?.label || status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move task');
      throw err;
    }
  };

  const handleTaskCreated = (task) => {
    if (!filters.project || filters.project === task.project?._id || filters.project === task.project) {
      setTasks((prev) => [task, ...prev]);
    } else {
      loadTasks();
    }
  };

  return (
    <div className="-m-6 flex flex-col h-[calc(100vh-4rem)] min-h-0">
      <div className="px-6 pt-6 pb-4 flex-shrink-0 space-y-4 bg-surface-50 border-b border-surface-200">
        <PageHeader
          title="Tasks"
          subtitle={`Kanban board · ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          className="!mb-0"
          action={
            <div className="flex gap-2">
              {canAddTask && (
                <button type="button" onClick={() => setShowAddTask(true)} className="btn-primary text-sm">
                  + Add Task
                </button>
              )}
              {canManagePhases && (
                <button type="button" onClick={() => setShowPhases(true)} className="btn-secondary text-sm">
                  Manage phases
                </button>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            className="input w-52 text-sm"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            className="input w-44 text-sm"
            value={filters.project}
            onChange={(e) => setFilters({ ...filters, project: e.target.value })}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <select
            className="input w-32 text-sm"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="text-xs text-surface-400 ml-auto hidden sm:inline">Scroll horizontally for more phases →</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : (
          <KanbanBoard
            columns={columns}
            tasks={tasks}
            onTasksChange={setTasks}
            onMoveTask={handleMoveTask}
            showProject={!filters.project}
            onOpenTask={setSelectedTaskId}
          />
        )}
      </div>

      <AddTaskModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onCreated={handleTaskCreated}
        defaultProjectId={filters.project}
      />

      <KanbanPhasesModal
        open={showPhases}
        onClose={() => setShowPhases(false)}
        columns={columns}
        onSaved={(cols) => {
          setColumns(cols);
          loadTasks();
        }}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={(updated) => {
          const id = updated._id?.toString?.() || updated._id;
          setTasks((prev) =>
            prev.map((t) => {
              const tid = t._id?.toString?.() || t._id;
              return tid === id ? { ...t, ...updated, assignee: updated.assignee ?? null } : t;
            })
          );
        }}
        onDeleted={(deletedId) => {
          setTasks((prev) => prev.filter((t) => t._id !== deletedId));
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
