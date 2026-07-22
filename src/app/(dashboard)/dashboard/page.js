'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate, PRIORITY_COLORS, TASK_STATUSES, PROJECT_STATUS_COLORS } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconProjects, IconTasks, IconClock, IconRevenue, IconChart } from '@/components/ui/Icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const STATUS_CHART_COLORS = ['#94a3b8', '#6366f1', '#f59e0b', '#22c55e', '#ef4444'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = ['super_admin', 'admin', 'manager'].includes(user?.role);

  useEffect(() => {
    dashboardAPI.getStats()
      .then((res) => setStats(res.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }
  if (!stats) return <p className="text-surface-500">Could not load dashboard.</p>;

  const taskStatsMap = Object.fromEntries((stats.taskStats || []).map((s) => [s._id, s.count]));
  const totalTasks = Object.values(taskStatsMap).reduce((a, b) => a + b, 0);

  const taskPieData = TASK_STATUSES.map((s, i) => ({
    name: s.label,
    value: taskStatsMap[s.value] || 0,
    color: STATUS_CHART_COLORS[i],
  })).filter((d) => d.value > 0);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? 'Organization overview — projects, tasks, and performance' : 'Your projects and assigned work'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={stats.totalProjects} icon={IconProjects} accent="primary" />
        <StatCard label="Active Projects" value={stats.activeProjects} icon={IconChart} accent="green" />
        <StatCard label="Open Tasks" value={totalTasks} icon={IconTasks} accent="violet" />
        <StatCard
          label="Hours This Week"
          value={`${(stats.hoursThisWeek || 0).toFixed(1)}h`}
          icon={IconClock}
          accent="amber"
        />
      </div>

      {isAdmin && stats.revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Revenue" value={formatCurrency(stats.revenue.revenue)} icon={IconRevenue} accent="green" />
          <StatCard label="Total Budget" value={formatCurrency(stats.revenue.budget)} icon={IconRevenue} accent="primary" />
          <StatCard label="Overdue Tasks" value={stats.overdueTasks || 0} change="Needs attention" icon={IconTasks} accent="rose" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Task Completion (7 Days)</h3>
          {stats.trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.trend} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">No completions in the last 7 days</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Task Status</h3>
          {taskPieData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">No tasks yet</p>
          )}
        </div>
      </div>

      {isAdmin && stats.teamPerformance?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Team Performance (This Week)</h3>
          <div className="space-y-3">
            {stats.teamPerformance.map((m) => (
              <div key={m._id} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-surface-700 truncate">{m.name}</div>
                <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, (m.hours / (stats.teamPerformance[0]?.hours || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-surface-600 w-14 text-right">{m.hours?.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-900">My Open Tasks</h3>
            <Link href="/tasks" className="text-primary-600 text-sm font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {stats.myTasks?.length ? stats.myTasks.map((task) => (
              <Link key={task._id} href={`/tasks/${task._id}`} className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary-50/50 transition-colors border border-transparent hover:border-primary-100">
                <span className={`badge ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 truncate">{task.title}</p>
                  <p className="text-xs text-surface-500">{task.project?.name} · Due {formatDate(task.dueDate)}</p>
                </div>
              </Link>
            )) : (
              <p className="text-surface-400 text-sm text-center py-8">No open tasks</p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-900">Recent Projects</h3>
            <Link href="/projects" className="text-primary-600 text-sm font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {stats.recentProjects?.length ? stats.recentProjects.map((project) => (
              <Link key={project._id} href={`/projects/${project._id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-violet-100 text-primary-700 rounded-xl flex items-center justify-center font-bold text-sm">
                  {project.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-900 truncate">{project.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`badge ${PROJECT_STATUS_COLORS[project.status]}`}>{project.status}</span>
                    <div className="flex-1 h-1.5 bg-surface-100 rounded-full">
                      <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-xs text-surface-500">{project.progress}%</span>
                  </div>
                </div>
              </Link>
            )) : (
              <p className="text-surface-400 text-sm text-center py-8">No projects yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
