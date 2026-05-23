'use client';

import { useState, useEffect } from 'react';
import { reportsAPI } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconChart, IconRevenue, IconTasks, IconTeam } from '@/components/ui/Icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsAPI.getAll()
      .then((res) => setReports(res.data.reports))
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

  if (!reports) return <p className="text-surface-500">Unable to load reports.</p>;

  const taskPie = (reports.taskCompletion || []).map((t, i) => ({
    name: (t._id || 'unknown').replace(/_/g, ' '),
    value: t.count,
    color: COLORS[i % COLORS.length],
  }));

  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Task completion, team productivity, and financial overview"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Completion Rate" value={`${reports.completionRate}%`} icon={IconChart} accent="primary" />
        <StatCard label="Team Members" value={reports.teamSize} icon={IconTeam} accent="violet" />
        <StatCard label="Total Revenue" value={formatCurrency(reports.revenue?.totalRevenue)} icon={IconRevenue} accent="green" />
        <StatCard label="Project Budget" value={formatCurrency(reports.revenue?.totalBudget)} icon={IconTasks} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Task Status Breakdown</h3>
          {taskPie.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={taskPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {taskPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">No task data</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 mb-4">Hours Logged (Trend)</h3>
          {(reports.timeTracking || []).length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={reports.timeTracking}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-400 text-sm text-center py-16">No time logs yet</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-surface-900 mb-4">Team Productivity (Hours)</h3>
        {(reports.productivity || []).length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reports.productivity} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="totalHours" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-surface-400 text-sm text-center py-12">No productivity data</p>
        )}
      </div>
    </div>
  );
}
