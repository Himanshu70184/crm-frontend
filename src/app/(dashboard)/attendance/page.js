'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconAttendance, IconClock, IconChart, IconTeam } from '@/components/ui/Icons';
import { attendanceAPI, usersAPI, getAssetUrl } from '@/lib/api';
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

// Converts a minute count into the same "X.Xh" hour format already used
// for worked hours, so late time reads consistently instead of a raw
// minute count (e.g. 237 -> "4.0h" instead of "237 min").
function formatMinutesAsHours(minutes) {
  const value = Number(minutes) || 0;
  return `${(value / 60).toFixed(1)}h`;
}

// Precise "Xh Ym Zs" breakdown of a worked-duration value expressed in
// minutes (which may carry a fractional part representing seconds, e.g.
// 144.5 minutes = 2h 24m 30s). Used anywhere a single session/day's
// worked time is shown, so it reads exactly rather than a rounded decimal.
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

// Captures a single frame from a screen share as a base64 JPEG.
//
// IMPORTANT BROWSER LIMITATION:
// getDisplayMedia() ALWAYS shows the browser's native picker dialog
// ("This Tab" / "Window" / "Entire Screen"). There is no way for a web
// page to silently grab the full desktop (with taskbar) — the user must
// explicitly choose "Entire Screen" in that dialog every time. This is
// enforced by the browser itself for security and cannot be bypassed
// from JS, even with preferCurrentTab or displaySurface hints — those
// only set which tab is PRE-SELECTED, not force silent capture.
//
// Below, we hint 'monitor' as the preferred/default surface so the
// picker opens with "Entire Screen" pre-selected, making it a single
// click for the user to include the taskbar/search bar.
async function captureFullScreenshot() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor', // hint: prefer "Entire Screen" option
    },
    // NOTE: no preferCurrentTab / no displaySurface:'browser' — those
    // were restricting the picker to tab-only capture.
    audio: false,
  });

  try {
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();

    // Let the user know if they picked something other than full screen
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

    // Full-monitor captures (especially on 1440p/4K screens) produce much
    // larger base64 strings than the old tab-only capture. The backend's
    // sanitizeScreenshot() rejects (silently, as null) anything over
    // ~4MB of base64, so we downscale here to keep things comfortably
    // under that cap while still being clearly legible.
    const MAX_DIMENSION = 1600;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(rawWidth, rawHeight));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rawWidth * scale);
    canvas.height = Math.round(rawHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // Step quality down until the encoded string fits comfortably under
    // the backend cap (~4MB base64 chars), rather than gambling on one
    // fixed quality value.
    const MAX_BASE64_LENGTH = 3.5 * 1024 * 1024; // leave headroom under the 4MB backend cap
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

  // When a preset (other than Custom) is chosen, compute its date range
  // and apply it immediately. Custom leaves the existing dates as-is and
  // just reveals the manual pickers below.
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
    setDatePreset('thisMonth');
    setFilters({ ...getMonthRange(), user: '' });
  };

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
      let screenshot = null;
      try {
        screenshot = await captureFullScreenshot();
      } catch (captureErr) {
        toast.error('Screenshot permission denied or unavailable — continuing without it');
      }

      const api = type === 'in' ? attendanceAPI.clockIn : attendanceAPI.clockOut;
      // screenshot (base64 data URL) is sent to the backend, which is
      // responsible for decoding it and writing it into a folder on disk
      // — see the backend snippet provided alongside this file.
      await api(screenshot ? { screenshot } : {});
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
                  {selfTodayRecord.workMinutes ? formatWorkedDuration(selfTodayRecord.workMinutes) : '0m 0s'}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  {selfTodayRecord.shiftName || 'Default shift'}
                  {selfTodayRecord.isLate ? ` • Late by ${formatMinutesAsHours(selfTodayRecord.lateMinutes)}` : ''}
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
                    {dateRecords.reduce((sum, record) => sum + (record.workMinutes || 0), 0) > 0
                      ? formatWorkedDuration(dateRecords.reduce((sum, record) => sum + (record.workMinutes || 0), 0))
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
                              {record.isLate && <span className="badge bg-amber-100 text-amber-700">Late {record.lateMinutes ? `(${formatMinutesAsHours(record.lateMinutes)})` : ''}</span>}
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
                            <p className="text-sm font-semibold text-surface-900">{record.workMinutes ? formatWorkedDuration(record.workMinutes) : '—'}</p>
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
    </div>
  );
}