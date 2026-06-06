'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconAttendance, IconClock, IconChart, IconTeam } from '@/components/ui/Icons';
import { attendanceAPI, usersAPI } from '@/lib/api';
import { formatDate, formatRelativeTime, getInitials, ROLE_COLORS } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const STATUS_META = {
  present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
  late: { label: 'Late', className: 'bg-amber-100 text-amber-700' },
  half_day: { label: 'Half Day', className: 'bg-blue-100 text-blue-700' },
  remote: { label: 'Remote', className: 'bg-violet-100 text-violet-700' },
  absent: { label: 'Absent', className: 'bg-rose-100 text-rose-700' },
  leave: { label: 'Leave', className: 'bg-sky-100 text-sky-700' },
  holiday: { label: 'Holiday', className: 'bg-fuchsia-100 text-fuchsia-700' },
  not_clocked_in: { label: 'Not Clocked In', className: 'bg-surface-100 text-surface-600' },
};

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date();
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const { user } = useAuth();
  const elevated = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selfTodayRecord, setSelfTodayRecord] = useState(null);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...getMonthRange(), user: '' }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, selfTodayRes, usersRes] = await Promise.all([
        attendanceAPI.getAll(filters),
        attendanceAPI.getToday(),
        elevated ? usersAPI.getAll({ limit: 300 }) : Promise.resolve({ data: { users: [] } }),
      ]);

      setRecords(attendanceRes.data.records || []);
      setSummary(attendanceRes.data.summary || null);
      setSelfTodayRecord(selfTodayRes.data.record || null);
      setUsers((usersRes.data.users || []).filter((item) => item.isActive !== false));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.user, filters.startDate, filters.endDate]);

  const canClockIn = !selfTodayRecord?.clockInAt;
  const canClockOut = Boolean(selfTodayRecord?.clockInAt && !selfTodayRecord?.clockOutAt);
  const groupedRecords = useMemo(() => {
    return records.reduce((acc, record) => {
      const dateKey = formatDate(record.attendanceDate);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);
      return acc;
    }, {});
  }, [records]);

  const handleClock = async (type) => {
    setSaving(true);
    try {
      const api = type === 'in' ? attendanceAPI.clockIn : attendanceAPI.clockOut;
      await api({});
      toast.success(type === 'in' ? 'Clock in recorded' : 'Clock out recorded');
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to clock ${type}`);
    } finally {
      setSaving(false);
    }
  };

  const currentStatusKey = selfTodayRecord?.status || (selfTodayRecord?.clockInAt ? 'present' : 'not_clocked_in');
  const currentStatusMeta = STATUS_META[currentStatusKey] || STATUS_META.present;
  const totalHoursText = `${Number(summary?.totalHours || 0).toFixed(1)}h`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Track daily clock-ins, clock-outs, and work duration"
        action={
          <div className="flex items-center gap-2">
            {canClockIn && (
              <button onClick={() => handleClock('in')} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Clock In'}
              </button>
            )}
            {canClockOut && (
              <button onClick={() => handleClock('out')} disabled={saving} className="btn-secondary">
                {saving ? 'Saving...' : 'Clock Out'}
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-4">
        <StatCard label="Records" value={summary?.totalRecords ?? 0} icon={IconAttendance} accent="primary" />
        <StatCard label="Worked Hours" value={totalHoursText} icon={IconClock} accent="green" />
        <StatCard label="Late Check-ins" value={summary?.lateCount ?? 0} icon={IconChart} accent="amber" />
        <StatCard label="Half Days" value={summary?.halfDayCount ?? 0} icon={IconTeam} accent="violet" />
        <StatCard label="Absent" value={summary?.absentCount ?? 0} icon={IconChart} accent="rose" />
        <StatCard label="On Leave" value={summary?.leaveCount ?? 0} icon={IconTeam} accent="primary" />
        <StatCard label="Holidays" value={summary?.holidayCount ?? 0} icon={IconAttendance} accent="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="font-semibold text-surface-900">Today</h3>
              <p className="text-sm text-surface-500">{formatDate(new Date())}</p>
            </div>
            <span className={`badge ${currentStatusMeta.className}`}>{currentStatusMeta.label}</span>
          </div>

          {selfTodayRecord ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-400 mb-1">Clock In</p>
                <p className="text-lg font-semibold text-surface-900">{formatTime(selfTodayRecord.clockInAt)}</p>
                <p className="text-xs text-surface-500 mt-1">{formatRelativeTime(selfTodayRecord.clockInAt)}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-400 mb-1">Clock Out</p>
                <p className="text-lg font-semibold text-surface-900">{formatTime(selfTodayRecord.clockOutAt)}</p>
                <p className="text-xs text-surface-500 mt-1">
                  {selfTodayRecord.clockOutAt ? formatRelativeTime(selfTodayRecord.clockOutAt) : 'Still on the clock'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-400 mb-1">Worked</p>
                <p className="text-lg font-semibold text-surface-900">
                  {selfTodayRecord.workMinutes ? `${(selfTodayRecord.workMinutes / 60).toFixed(1)}h` : '0.0h'}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  {selfTodayRecord.shiftName || 'Default shift'}
                  {selfTodayRecord.isLate ? ` • Late by ${selfTodayRecord.lateMinutes || 0} min` : ''}
                  {selfTodayRecord.isHalfDay ? ' • Half day' : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-6 py-10 text-center">
              <p className="font-medium text-surface-800">No attendance record yet for today</p>
              <p className="text-sm text-surface-500 mt-1">Use Clock In to start tracking your day.</p>
            </div>
          )}
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-surface-900">Filters</h3>
            <p className="text-sm text-surface-500">Scope the attendance log window</p>
          </div>

          {elevated && (
            <div>
              <label className="label">User</label>
              <select
                className="input"
                value={filters.user}
                onChange={(e) => setFilters((prev) => ({ ...prev, user: e.target.value }))}
              >
                <option value="">All users</option>
                {users.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} ({item.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                className="input"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                type="date"
                className="input"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <button type="button" className="btn-secondary w-full" onClick={() => setFilters({ ...getMonthRange(), user: '' })}>
            Reset Range
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900">Attendance Log</h3>
            <p className="text-sm text-surface-500">Grouped by date</p>
          </div>
          <span className="text-sm text-surface-500">{records.length} record{records.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 text-center text-surface-400">
            No attendance records found for the selected range.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {Object.entries(groupedRecords).map(([dateLabel, dateRecords]) => (
              <div key={dateLabel} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-surface-900">{dateLabel}</h4>
                  <span className="text-xs text-surface-500">
                    {dateRecords.reduce((sum, record) => sum + (record.workMinutes || 0), 0) > 0
                      ? `${(dateRecords.reduce((sum, record) => sum + (record.workMinutes || 0), 0) / 60).toFixed(1)}h`
                      : 'No work duration'}
                  </span>
                </div>
                <div className="space-y-3">
                  {dateRecords.map((record) => {
                    const status = STATUS_META[record.status] || STATUS_META.present;
                    return (
                      <div key={record._id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {getInitials(record.user?.name || 'A')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-surface-900 truncate">{record.user?.name}</p>
                              <span className={`badge ${ROLE_COLORS[record.user?.role] || ROLE_COLORS.team_member}`}>{record.user?.role}</span>
                              <span className={`badge ${status.className}`}>{status.label}</span>
                              {record.isLate && <span className="badge bg-amber-100 text-amber-700">Late {record.lateMinutes ? `(${record.lateMinutes}m)` : ''}</span>}
                              {record.isHalfDay && <span className="badge bg-blue-100 text-blue-700">Half Day</span>}
                            </div>
                            <p className="text-xs text-surface-500 truncate">
                              {record.user?.department || 'No department'}
                              {record.shiftName ? ` • ${record.shiftName}` : ''}
                              {record.holidayName ? ` • ${record.holidayName}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
                          <div>
                            <p className="text-[11px] uppercase text-surface-400">In</p>
                            <p className="text-sm font-semibold text-surface-900">{formatTime(record.clockInAt)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase text-surface-400">Out</p>
                            <p className="text-sm font-semibold text-surface-900">{formatTime(record.clockOutAt)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase text-surface-400">Worked</p>
                            <p className="text-sm font-semibold text-surface-900">{record.workMinutes ? `${(record.workMinutes / 60).toFixed(1)}h` : '—'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}