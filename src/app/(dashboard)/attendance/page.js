'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconAttendance, IconClock, IconChart, IconTeam } from '@/components/ui/Icons';
import { attendanceAPI, usersAPI, getAssetUrl } from '@/lib/api';
import { formatDate, formatRelativeTime, getInitials, ROLE_COLORS } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import LateCheckInApprovals from './LateCheckInApprovals'; // adjust path to wherever you save it

const STATUS_META = {
  present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
  late: { label: 'Late', className: 'bg-amber-100 text-amber-700' },
  half_day: { label: 'Half Day', className: 'bg-blue-100 text-blue-700' },
  remote: { label: 'Remote', className: 'bg-violet-100 text-violet-700' },
  absent: { label: 'Absent', className: 'bg-rose-100 text-rose-700' },
  leave: { label: 'Leave', className: 'bg-sky-100 text-sky-700' },
  holiday: { label: 'Holiday', className: 'bg-fuchsia-100 text-fuchsia-700' },
  not_clocked_in: { label: 'Not Clocked In', className: 'bg-surface-100 text-surface-600' },
  // FIX: new status for late check-in requests that were rejected. Distinct
  // from plain 'absent' so the row itself can be highlighted red and the
  // rejection reason shown, instead of looking like an unexplained absence.
  rejected: { label: 'Check-in Rejected', className: 'bg-rose-100 text-rose-700' },
};

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date();
  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
  };
}

// Preset date range calculators, keyed by dropdown value.
const DATE_PRESETS = {
  today: () => {
    const now = new Date();
    return { startDate: toISODate(now), endDate: toISODate(now) };
  },
  yesterday: () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { startDate: toISODate(d), endDate: toISODate(d) };
  },
  last7: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  },
  thisMonth: () => getMonthRange(),
  custom: null,
};

const PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// FIX: previously always converted to hours (e.g. 32 min -> "0.5h"), which
// hides small/precise late durations. Now shows plain minutes under an
// hour, and hours (plus leftover minutes, if any) once it crosses 60.
function formatLateDuration(minutes) {
  const value = Math.round(Number(minutes) || 0);
  if (value < 60) return `${value}m`;
  const hrs = Math.floor(value / 60);
  const mins = value % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatWorkedDuration(minutesValue) {
  const totalMinutes = Number(minutesValue) || 0;
  const totalSeconds = Math.round(totalMinutes * 60);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

// Prefer the idle-adjusted tracked time reported by the desktop Activity
// Tracker app (workedMs/workedHours) over the wall-clock workMinutes, so the
// UI shows the actual working time (excluding idle/paused periods).
function getWorkedMinutes(record) {
  if (!record) return 0;
  if (record.workedMs != null && Number(record.workedMs) > 0) {
    return Math.round(Number(record.workedMs) / 60000);
  }
  if (record.workedHours != null && Number(record.workedHours) > 0) {
    return Math.round(Number(record.workedHours) * 60);
  }
  return Number(record.workMinutes) || 0;
}

async function captureFullScreenshot() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
    },
    audio: false,
  });

  try {
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();

    if (settings.displaySurface && settings.displaySurface !== 'monitor') {
      toast('Tip: choose "Entire Screen" next time to include the taskbar', {
        icon: 'ℹ️',
      });
    }

    const imageCapture = 'ImageCapture' in window ? new window.ImageCapture(track) : null;

    let bitmap;
    if (imageCapture) {
      bitmap = await imageCapture.grabFrame();
    } else {
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 150));
      bitmap = video;
    }

    const rawWidth = bitmap.width || bitmap.videoWidth;
    const rawHeight = bitmap.height || bitmap.videoHeight;

    const MAX_DIMENSION = 1600;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(rawWidth, rawHeight));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rawWidth * scale);
    canvas.height = Math.round(rawHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const MAX_BASE64_LENGTH = 3.5 * 1024 * 1024;
    let quality = 0.75;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (dataUrl.length > MAX_BASE64_LENGTH && quality > 0.3) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
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
  const [datePreset, setDatePreset] = useState('today');
  const [filters, setFilters] = useState(() => ({ ...DATE_PRESETS.today(), user: '' }));
  const [viewScreenshot, setViewScreenshot] = useState(null);

  // Late check-in approval flow state.
  // `pendingLateCheckIn` mirrors what GET /api/attendance/today returns
  // when the user has an unresolved (pending) late check-in request for
  // today — so a refresh/re-login shows the "awaiting approval" state
  // instead of letting them clock in again.
  const [pendingLateCheckIn, setPendingLateCheckIn] = useState(null);
  const [lateDialogOpen, setLateDialogOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [lateScreenshot, setLateScreenshot] = useState(null);
  const [submittingLateRequest, setSubmittingLateRequest] = useState(false);

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
      // Backend attaches the user's own pending late-checkin request
      // (if any) alongside today's record so the UI can render the
      // "awaiting approval" state on load.
      setPendingLateCheckIn(selfTodayRes.data.pendingLateCheckIn || null);
      setUsers(
        (usersRes.data.users || []).filter(
          (item) => item.isActive !== false && item.role !== 'client'
        )
      );
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.user, filters.startDate, filters.endDate]);

  const handlePresetChange = (value) => {
    setDatePreset(value);
    const compute = DATE_PRESETS[value];
    if (compute) {
      setFilters((prev) => ({ ...prev, ...compute() }));
    }
  };

  const handleManualDateChange = (field, value) => {
    setDatePreset('custom');
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetRange = () => {
    setDatePreset('today');
    setFilters({ ...DATE_PRESETS.today(), user: '' });
  };

  const canClockIn = !selfTodayRecord?.clockInAt && !pendingLateCheckIn && selfTodayRecord?.status !== 'rejected';
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
      // A screenshot is REQUIRED by the backend (AttendanceRecord schema
      // marks clockInScreenshot/clockOutScreenshot as required). If screen
      // capture fails or permission is denied, we must NOT call the
      // clock-in/out API at all — sending the request without a screenshot
      // only fails later with a confusing Mongoose validation error.
      // Instead, stop here with a clear, actionable message.
      let screenshot;
      try {
        screenshot = await captureFullScreenshot();
      } catch (captureErr) {
        toast.error(`Please allow screen sharing to clock ${type}`, {
          style: { maxWidth: 460, whiteSpace: 'nowrap' },
        });
        return;
      }

      const api = type === 'in' ? attendanceAPI.clockIn : attendanceAPI.clockOut;
      await api({ screenshot });
      toast.success(type === 'in' ? 'Clock in recorded' : 'Clock out recorded');
      await fetchData();
    } catch (error) {
      // The backend responds 428 with { requiresApproval: true } in two
      // cases: (1) a brand-new late attempt outside the buffer window, or
      // (2) the user already has a pending request (data.pending: true).
      // Handle them differently so a double-click / stale-state race
      // doesn't reopen the reason dialog on top of an existing request.
      if (type === 'in' && error.response?.status === 428 && error.response?.data?.requiresApproval) {
        if (error.response.data.pending) {
          toast.error('Your check-in request is already awaiting approval');
          await fetchData(); // resync pendingLateCheckIn state
          return;
        }
        setLateScreenshot(error.response.data.screenshot || null);
        setLateDialogOpen(true);
        return;
      }
      toast.error(error.response?.data?.message || `Failed to clock ${type}`);
    } finally {
      setSaving(false);
    }
  };

  // Submits the late check-in request with the user's reason. Does NOT
  // clock the user in — it only creates a pending request for admin/manager/
  // HR to approve or reject. Reuses the screenshot captured during the
  // original clock-in attempt.
  const handleSubmitLateReason = async () => {
    if (!lateReason.trim()) {
      toast.error('Please enter a reason for the delay');
      return;
    }
    setSubmittingLateRequest(true);
    try {
      let screenshot = lateScreenshot;
      if (!screenshot) {
        try {
          screenshot = await captureFullScreenshot();
        } catch {
          toast.error('Please allow screen sharing to submit your check-in request');
          setSubmittingLateRequest(false);
          return;
        }
      }

      const res = await attendanceAPI.requestLateCheckIn({ reason: lateReason.trim(), screenshot });
      toast.success('Request sent — waiting for approval');
      setPendingLateCheckIn(res.data.request);
      setLateDialogOpen(false);
      setLateReason('');
      setLateScreenshot(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmittingLateRequest(false);
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

      {/* Admin/manager/HR pending late check-in approvals. Renders nothing
          (returns null) when the list is empty, so it never adds blank
          space to the page for elevated users with nothing to review. */}
      {elevated && (
        <LateCheckInApprovals onResolved={fetchData} />
      )}

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
            {!pendingLateCheckIn && <span className={`badge ${currentStatusMeta.className}`}>{currentStatusMeta.label}</span>}
          </div>

          {/* Pending approval banner — shown instead of the empty state
              once a late check-in request has been submitted and is
              awaiting a decision from admin/manager/HR. */}
          {pendingLateCheckIn ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 text-center">
              <p className="font-medium text-amber-900">Check-in request pending approval</p>
              <p className="text-sm text-amber-700 mt-1">
                {/* FIX: LateCheckInRequest has no 'requestedAt' field.
                    Use 'createdAt' (when the request was submitted) —
                    swap to 'requestedClockInAt' instead if you'd rather
                    show the originally attempted clock-in time. */}
                Requested at {formatTime(pendingLateCheckIn.createdAt)} — reason: "{pendingLateCheckIn.reason}"
              </p>
              <p className="text-xs text-amber-600 mt-2">You'll be notified once it's reviewed.</p>
            </div>
          ) : selfTodayRecord?.status === 'rejected' ? (
            // FIX: once today's late check-in is rejected, Clock In is
            // hidden (see canClockIn above) — this banner replaces the
            // empty state so the user understands why, instead of the page
            // just looking broken with no clock-in option and no record.
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 text-center">
              <p className="font-medium text-rose-900">Your check-in was rejected</p>
              {selfTodayRecord?.note && (
                <p className="text-sm text-rose-700 mt-1">{selfTodayRecord.note}</p>
              )}
              <p className="text-xs text-rose-600 mt-2">Please contact your admin or HR to resolve today's attendance.</p>
            </div>
          ) : selfTodayRecord ? (
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
                  {getWorkedMinutes(selfTodayRecord) ? formatWorkedDuration(getWorkedMinutes(selfTodayRecord)) : '0m 0s'}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  {selfTodayRecord.shiftName || 'Default shift'}
                  {selfTodayRecord.isLate ? ` • Late by ${formatLateDuration(selfTodayRecord.lateMinutes)}` : ''}
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

          <div className="flex flex-col sm:flex-row gap-3">
            {elevated && (
              <div className="flex-1">
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

            <div className="flex-1">
              <label className="label">Date range</label>
              <select
                className="input"
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Start date</label>
                <input
                  type="date"
                  className="input"
                  value={filters.startDate}
                  onChange={(e) => handleManualDateChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End date</label>
                <input
                  type="date"
                  className="input"
                  value={filters.endDate}
                  onChange={(e) => handleManualDateChange('endDate', e.target.value)}
                />
              </div>
            </div>
          )}

          <button type="button" className="btn-secondary w-full" onClick={handleResetRange}>
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
                    {dateRecords.reduce((sum, record) => sum + getWorkedMinutes(record), 0) > 0
                      ? formatWorkedDuration(dateRecords.reduce((sum, record) => sum + getWorkedMinutes(record), 0))
                      : 'No work duration'}
                  </span>
                </div>
                <div className="space-y-3">
                  {dateRecords.map((record) => {
                    const status = STATUS_META[record.status] || STATUS_META.present;
                    const isRejected = record.status === 'rejected';
                    return (
                      <div
                        key={record._id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3 ${
                          isRejected
                            ? 'border-rose-200 bg-rose-50'
                            : 'border-surface-200 bg-surface-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0"
                           style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}>
                            {getInitials(record.user?.name || 'A')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-surface-900 truncate" >{record.user?.name}</p>
                              <span className={`badge ${ROLE_COLORS[record.user?.role] || ROLE_COLORS.team_member}`}>{record.user?.role}</span>
                              {/* FIX: previously rendered BOTH the generic status badge
                                  ("Late") AND the detailed isLate badge ("Late (2.6h)")
                                  whenever a record was late, causing a visible duplicate.
                                  Now only ONE badge renders: the detailed late badge
                                  (with minutes/hours) when isLate is true, otherwise the
                                  normal status badge for every other status. */}
                              {isRejected ? (
                                <span className={`badge ${status.className}`}>{status.label}</span>
                              ) : record.isLate ? (
                                <span className="badge bg-amber-100 text-amber-700">
                                  Late{record.lateMinutes ? ` (${formatLateDuration(record.lateMinutes)})` : ''}
                                </span>
                              ) : (
                                <span className={`badge ${status.className}`}>{status.label}</span>
                              )}
                              {record.isHalfDay && <span className="badge bg-blue-100 text-blue-700">Half Day</span>}
                            </div>
                            <p className="text-xs text-surface-500 truncate">
                              {record.user?.department || 'No department'}
                              {record.shiftName ? ` • ${record.shiftName}` : ''}
                              {record.holidayName ? ` • ${record.holidayName}` : ''}
                            </p>
                            {isRejected && record.note && (
                              <p className="text-xs text-rose-700 mt-1">{record.note}</p>
                            )}
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
                            <p className="text-sm font-semibold text-surface-900">{getWorkedMinutes(record) ? formatWorkedDuration(getWorkedMinutes(record)) : '—'}</p>
                          </div>
                        </div>

                        {(record.clockInScreenshot || record.clockOutScreenshot) && (
                          <div className="flex gap-2 sm:ml-2">
                            {record.clockInScreenshot && (
                              <button
                                type="button"
                                onClick={() => setViewScreenshot(record.clockInScreenshot)}
                                className="text-xs px-2 py-1 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
                              >
                                In shot
                              </button>
                            )}
                            {record.clockOutScreenshot && (
                              <button
                                type="button"
                                onClick={() => setViewScreenshot(record.clockOutScreenshot)}
                                className="text-xs px-2 py-1 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
                              >
                                Out shot
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewScreenshot && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setViewScreenshot(null)}
        >
          <img
            src={getAssetUrl(viewScreenshot)}
            alt="Attendance screenshot"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Reason dialog shown when clock-in falls outside the shift's
          buffer window. Submitting sends the reason for admin/manager/HR
          approval instead of clocking in directly. */}
      {lateDialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submittingLateRequest && setLateDialogOpen(false)}
        >
          <div
            className="card w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-surface-900">You're checking in late</h3>
              <p className="text-sm text-surface-500 mt-1">
                Your shift's grace period has passed. Please share a reason — your check-in will need approval from an admin, manager, or HR before it's recorded.
              </p>
            </div>
            <div>
              <label className="label">Reason for delay</label>
              <textarea
                className="input"
                rows={3}
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="e.g. Stuck in traffic, medical appointment..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={submittingLateRequest}
                onClick={() => { setLateDialogOpen(false); setLateReason(''); setLateScreenshot(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submittingLateRequest}
                onClick={handleSubmitLateReason}
              >
                {submittingLateRequest ? 'Sending...' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}