'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { projectsAPI } from '@/lib/api';
import { formatDate, PROJECT_STATUS_COLORS } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const STATUSES = ['', 'planning', 'active', 'on_hold', 'completed', 'cancelled'];

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { user } = useAuth();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await projectsAPI.getAll(params);
      setProjects(res.data.projects);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, [search, status]);

  const canCreate = ['admin', 'manager'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects.length} projects</p>
        </div>
        {canCreate && (
          <Link href="/projects/new" className="btn-primary">
            + New Project
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          className="input w-64"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600" /></div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No projects found</p>
          {canCreate && <Link href="/projects/new" className="btn-primary inline-block">Create your first project</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <Link href={`/projects/${project._id}`} className="card p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <span className={`badge ${PROJECT_STATUS_COLORS[project.status]}`}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1 truncate">{project.name}</h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{project.description || 'No description'}</p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="bg-gray-200 rounded-full h-2">
          <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Due {formatDate(project.endDate)}</span>
        <div className="flex -space-x-2">
          {project.team?.slice(0, 4).map((member) => (
            <div key={member._id} className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs border-2 border-white font-medium" title={member.name}>
              {member.name?.charAt(0).toUpperCase()}
            </div>
          ))}
          {project.team?.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs border-2 border-white">
              +{project.team.length - 4}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
