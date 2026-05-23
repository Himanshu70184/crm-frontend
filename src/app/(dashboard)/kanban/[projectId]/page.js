'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { tasksAPI, projectsAPI, settingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_COLUMNS } from '@/lib/kanban';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import KanbanPhasesModal from '@/components/kanban/KanbanPhasesModal';
import toast from 'react-hot-toast';

export default function KanbanPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const canManagePhases = ['admin', 'manager'].includes(user?.role);

  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('');
  const [showPhases, setShowPhases] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      projectsAPI.getOne(projectId),
      tasksAPI.getAll({ project: projectId, limit: 500 }),
      settingsAPI.getKanbanColumns(),
    ])
      .then(([pRes, tRes, cRes]) => {
        setProject(pRes.data.project);
        setTasks(tRes.data.tasks);
        setColumns(cRes.data.columns);
      })
      .catch(() => toast.error('Failed to load Kanban'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const filteredTasks = filterPriority
    ? tasks.filter((t) => t.priority === filterPriority)
    : tasks;

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

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="-m-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-surface-200 bg-surface-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-surface-500 mb-1">
              <Link href="/projects" className="hover:text-primary-600">Projects</Link>
              <span>/</span>
              <Link href={`/projects/${projectId}`} className="hover:text-primary-600">{project?.name}</Link>
              <span>/</span>
              <span>Kanban</span>
            </div>
            <h1 className="text-2xl font-bold text-surface-900">Kanban Board</h1>
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-36 text-sm" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {canManagePhases && (
              <button type="button" onClick={() => setShowPhases(true)} className="btn-secondary text-sm">
                Manage phases
              </button>
            )}
            <Link href="/tasks" className="btn-ghost text-sm">All tasks board</Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto px-6 py-4">
        <KanbanBoard
          columns={columns}
          tasks={filteredTasks}
          onTasksChange={setTasks}
          onMoveTask={handleMoveTask}
          showProject={false}
        />
      </div>

      <KanbanPhasesModal
        open={showPhases}
        onClose={() => setShowPhases(false)}
        columns={columns}
        onSaved={(cols) => {
          setColumns(cols);
          load();
        }}
      />
    </div>
  );
}
