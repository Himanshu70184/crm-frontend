'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconAttendance, IconClock, IconChart, IconTeam } from '@/components/ui/Icons';
import Avatar from '@/components/ui/Avatar';
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
  pending: { label: 'Pending Approval', className: 'bg-orange-100 text-orange-700' },
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

function formatMinutesAsHours(minutes) {
  const value = Number(minutes) || 0;
  return `${(value / 60).toFixed(1)}h`;
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

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const elevated = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const canReviewLate = ['super_admin', 'admin', 'hr', 'manager'].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selfTodayRecord, setSelfTodayRecord] = useState(null);
  const [users, setUsers] = useState([]);
  const [datePreset, setDatePreset] = useState('today');
  const [filters, setFilters] = useState(() => ({ ...DATE_PRESETS.today(), user: '' }));
  // Late check-in reason modal state (opened when the server says a reason is
  // required for the delayed clock-in) and the late-approval queue state.
  const [lateReasonModal, setLateReasonModal] = useState({ open: false, lateMinutes: 0, value: '' });
  const [lateCheckIns, setLateCheckIns] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  // Leave request modal state
  const [leaveRequestModal, setLeaveRequestModal] = useState({ open: false, leaveType: 'annual', startDate: '', endDate: '', reason: '' });
  const [leaveRequestSent, setLeaveRequestSent] = useState(false);
  const [leaveRequestEmails, setLeaveRequestEmails] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // allSettled so one failing request can never blank the whole page and
      // leave a stale "Clock In" button behind after a successful clock-in.
      const [attendanceRes, selfTodayRes, usersRes, lateRes] = await Promise.allSettled([
        attendanceAPI.getAll(filters),
        attendanceAPI.getToday(),
        elevated ? usersAPI.getAll({ limit: 300 }) : Promise.resolve({ data: { users: [] } }),
        canReviewLate ? attendanceAPI.getLateCheckIns() : Promise.resolve({ data: { records: [] } }),
      ]);

      if (attendanceRes.status === 'fulfilled') {
        setRecords(attendanceRes.value.data.records || []);
        setSummary(attendanceRes.value.data.summary || null);
      }
      if (selfTodayRes.status === 'fulfilled') {
        setSelfTodayRecord(selfTodayRes.value.data.record || null);
      }
      if (lateRes.status === 'fulfilled') {
        setLateCheckIns(lateRes.value.data.records || []);
      }
      if (usersRes.status === 'fulfilled') {
        setUsers(
          (usersRes.value.data.users || []).filter(
            (item) => item.isActive !== false && item.role !== 'client'
          )
        );
      }
      const criticalFailure = [attendanceRes, selfTodayRes].find((r) => r.status === 'rejected');
      if (criticalFailure) {
        toast.error(criticalFailure.reason?.response?.data?.message || 'Failed to load attendance');
      }
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

  // Admins and Super Admins do not perform check-in/check-out — they manage attendance for others.
  const isCheckInAllowed = !['admin', 'super_admin'].includes(user?.role);
  const canClockIn = isCheckInAllowed && !selfTodayRecord?.clockInAt;
  const canClockOut = isCheckInAllowed && Boolean(selfTodayRecord?.clockInAt && !selfTodayRecord?.clockOutAt);
  // While a late check-in is awaiting approval, show a "Pending Approval"
  // pill instead of action buttons; Clock Out appears once it is reviewed.
  // Status 'pending' alone is enough (covers records saved before the
  // lateApprovalStatus field existed).
  const isPendingApproval = Boolean(
    selfTodayRecord?.status === 'pending' ||
    selfTodayRecord?.lateApprovalStatus === 'pending'
  );
  const groupedRecords = useMemo(() => {
    return records.reduce((acc, record) => {
      const dateKey = formatDate(record.attendanceDate);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);
      return acc;
    }, {});
  }, [records]);

  const handleClock = async (type, extraData = {}) => {
    setSaving(true);
    try {
      const api = type === 'in' ? attendanceAPI.clockIn : attendanceAPI.clockOut;
      const res = await api(extraData);
      // Sync instantly from the response so the button flips to the Pending /
      // Clock Out state without waiting for the refetch.
      if (res.data?.record) setSelfTodayRecord(res.data.record);
      if (res.data?.alreadyClockedIn) {
        toast('You are already clocked in today', { icon: 'ℹ️' });
      } else {
        toast.success(type === 'in' ? 'Clock in recorded' : 'Clock out recorded');
      }
      await fetchData();
      return res;
    } catch (error) {
      // Late clock-in without a reason: the server asks for one — open the
      // reason modal so the user can explain the delay, then retry.
      if (
        type === 'in' &&
        error.response?.data?.code === 'LATE_REASON_REQUIRED'
      ) {
        setLateReasonModal({
          open: true,
          lateMinutes: error.response.data.lateMinutes || 0,
          value: '',
        });
      } else {
        toast.error(error.response?.data?.message || `Failed to clock ${type}`);
        // State may have drifted (e.g. clocked in from another tab) — refresh
        // silently so the buttons always reflect the server state.
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const submitLateClockIn = async (e) => {
    e.preventDefault();
    const reason = lateReasonModal.value.trim();
    if (!reason) return toast.error('Please enter the reason for your late check-in');
    setLateReasonModal((prev) => ({ ...prev, open: false }));
    await handleClock('in', { lateReason: reason });
  };

  const handleLateReview = async (recordId, decision) => {
    setReviewingId(recordId);
    try {
      await attendanceAPI.reviewLateCheckIn(recordId, { decision });
      toast.success(decision === 'approved' ? 'Late check-in approved' : 'Late check-in rejected');
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to review late check-in');
    } finally {
      setReviewingId(null);
    }
  };

  // Apply for leave with email notification to HR
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveRequestModal.startDate || !leaveRequestModal.endDate) {
      return toast.error('Please select start and end dates');
    }
    
    setSaving(true);
    try {
      const result = await attendanceAPI.applyLeave({
        leaveType: leaveRequestModal.leaveType,
        startDate: leaveRequestModal.startDate,
        endDate: leaveRequestModal.endDate,
        reason: leaveRequestModal.reason,
        notifyViaEmail: true,
      });

      setLeaveRequestSent(true);
      setLeaveRequestEmails(result.data.emailsSentTo || []);
      setLeaveRequestModal({ open: false, leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      
      toast.success('Leave request submitted successfully! Opening leave module...');
      await fetchData();
      router.push('/attendance/leaves');
    } catch (error) {
      console.log('Leave request error:', error.response?.data);
      const errorMessage = error.response?.data?.message || 
        error.response?.data?.error || 
        error.message || 
        'Failed to submit leave request';
      
      // Show specific error messages for common issues
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else if (error.response?.status === 400) {
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  // Open leave request modal
  const openLeaveRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setLeaveRequestModal({ 
      open: true, 
      leaveType: 'annual', 
      startDate: today, 
      endDate: today, 
      reason: '' 
    });
    setLeaveRequestSent(false);
    setLeaveRequestEmails([]);
    };

  // On Leave card opens the dedicated leave module page.
  const openLeaveModule = () => {
    router.push('/attendance/leaves');
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
            {isPendingApproval ? (
              <span
                className="badge bg-orange-100 text-orange-700 px-4 py-2.5 text-sm font-medium"
                title="Your late check-in reason is awaiting approval — Clock Out unlocks after review"
              >
                ⏳ Pending Approval
              </span>
            ) : (
              <>
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
                {/* Leave request button - available to all non-admin users */}
                {!['admin', 'super_admin'].includes(user?.role) && (
                  <button 
                    onClick={openLeaveRequestModal} 
                    disabled={saving || isPendingApproval}
                    className="btn-secondary"
                    title="Request leave with email notification to HR"
                  >
                    📅 Request Leave
                  </button>
                )}
              </>
            )}
          </div>
        }
            />

      {/* Leave lists moved to /attendance/leaves. On Leave card navigates there. */}

      {/* Late check-in reason modal — shown when the server requires a reason
          for the delayed clock-in. The record goes to 'pending' after submit. */}
      {lateReasonModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submitLateClockIn} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Late check-in reason</h3>
              <p className="text-sm text-surface-500 mt-1">
                You are <strong>{lateReasonModal.lateMinutes} minute(s)</strong> late for your shift. Please provide the
                reason for the delay — it will be sent to your approver for review.
              </p>
            </div>
            <textarea
              className="input min-h-[110px]"
              placeholder="e.g. Doctor appointment, traffic, transport delay..."
              value={lateReasonModal.value}
              autoFocus
              onChange={(e) => setLateReasonModal((prev) => ({ ...prev, value: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLateReasonModal((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
       )}

      {/* Leave request modal section */}
      {leaveRequestModal.open && !leaveRequestSent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleApplyLeave} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-surface-900">Request Leave</h3>
              <p className="text-sm text-surface-500 mt-1">Submit a leave request with email notification to HR.</p>
            </div>
            <div>
              <label className="label">Leave Type</label>
              <select
                className="input"
                value={leaveRequestModal.leaveType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setLeaveRequestModal((prev) => ({
                    ...prev,
                    leaveType: nextType,
                    // A half day can only cover a single date, so keep the end
                    // date pinned to the start date.
                    endDate: nextType === 'half_day' ? prev.startDate : prev.endDate,
                  }));
                }}
              >
                <option value="annual">Annual Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="half_day">Half Day Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={leaveRequestModal.startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setLeaveRequestModal((prev) => ({
                      ...prev,
                      startDate: nextStart,
                      endDate: prev.leaveType === 'half_day' ? nextStart : prev.endDate,
                    }));
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={leaveRequestModal.endDate}
                  onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, endDate: e.target.value }))}
                  min={leaveRequestModal.startDate || new Date().toISOString().split('T')[0]}
                  disabled={leaveRequestModal.leaveType === 'half_day'}
                />
                {leaveRequestModal.leaveType === 'half_day' && (
                  <p className="text-xs text-surface-400 mt-1">Half day covers a single date.</p>
                )}
              </div>
            </div>
            <div>
              <label className="label">Reason <span className="text-surface-400 font-normal">(optional)</span></label>
              <textarea className="input min-h-[100px]" placeholder="e.g., Family vacation, medical appointment..." value={leaveRequestModal.reason} onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, reason: e.target.value }))} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              <p className="font-medium">📧 Email Notification</p>
              <p className="text-xs mt-1 text-amber-600">An email will be sent to all HR and Admin users.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLeaveRequestModal((prev) => ({ ...prev, open: false }))}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Leave request success Section */}
      {leaveRequestModal.open && leaveRequestSent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-lg font-semibold text-surface-900">Leave Request Submitted!</h3>
            <p className="text-sm text-surface-500 mt-1">Your leave request has been submitted. Email notifications have been sent to HR.</p>
            {leaveRequestEmails.length > 0 && (
              <div className="mt-4 bg-surface-50 rounded-xl p-3 text-left">
                <p className="text-xs uppercase tracking-wide text-surface-400 font-medium mb-2">Emails Sent To:</p>
                {leaveRequestEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-surface-700">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="btn-secondary" onClick={() => { setLeaveRequestSent(false); setLeaveRequestModal((prev) => ({ ...prev, open: true, leaveType: 'annual', startDate: '', endDate: '', reason: '' })); }}>Submit Another</button>
              <button type="button" className="btn-primary" onClick={() => { setLeaveRequestModal({ open: false, leaveType: 'annual', startDate: '', endDate: '', reason: '' }); setLeaveRequestEmails([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Late check-in approval queue — visible to Super Admin/Admin/HR/Manager.
          HR & Manager requests appear only for Super Admin/Admin (server-side
          filtered), matching the approval routing rules. */}
      {canReviewLate && lateCheckIns.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-surface-900">Late Check-in Approvals</h3>
              <p className="text-sm text-surface-500">
                {lateCheckIns.length} pending review{lateCheckIns.length === 1 ? '' : 's'} — your approval is required
              </p>
            </div>
            <span className="badge bg-orange-100 text-orange-700">{lateCheckIns.length}</span>
          </div>
          <div className="space-y-3">
            {lateCheckIns.map((record) => (
              <div key={record._id} className="rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar name={record.user?.name || 'U'} src={record.user?.avatar || ''} size={8} />
                  <p className="font-medium text-surface-900">{record.user?.name}</p>
                  <span className={`badge ${ROLE_COLORS[record.user?.role] || ROLE_COLORS.team_member}`}>{record.user?.role}</span>
                  <span className="text-xs text-surface-500">
                    {formatDate(record.attendanceDate)} • clocked in {formatTime(record.clockInAt)} • late by {formatMinutesAsHours(record.lateMinutes)}
                  </span>
                </div>
                <div className="rounded-xl bg-white border border-orange-100 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-surface-400 mb-0.5">Reason</p>
                  <p className="text-sm text-surface-800">{record.lateReason || '—'}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={reviewingId === record._id}
                    onClick={() => handleLateReview(record._id, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={reviewingId === record._id}
                    onClick={() => handleLateReview(record._id, 'approved')}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-4">
        <StatCard label="Records" value={summary?.totalRecords ?? 0} icon={IconAttendance} accent="primary" />
        <StatCard label="Worked Hours" value={totalHoursText} icon={IconClock} accent="green" />
        <StatCard label="Late Check-ins" value={summary?.lateCount ?? 0} icon={IconChart} accent="amber" />
        <StatCard label="Half Days" value={summary?.halfDayCount ?? 0} icon={IconTeam} accent="violet" />
        <StatCard label="Absent" value={summary?.absentCount ?? 0} icon={IconChart} accent="rose" />
        <StatCard label="On Leave" value={summary?.leaveCount ?? 0} icon={IconTeam} accent="primary" onClick={openLeaveModule} title="Open leave module" />
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
                  {getWorkedMinutes(selfTodayRecord) ? formatWorkedDuration(getWorkedMinutes(selfTodayRecord)) : '0m 0s'}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  {selfTodayRecord.shiftName || 'Default shift'}
                  {selfTodayRecord.isLate ? ` • Late by ${formatMinutesAsHours(selfTodayRecord.lateMinutes)}` : ''}
                  {selfTodayRecord.lateApprovalStatus === 'pending' ? ' • Awaiting approval' : ''}
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
                    return (
                      <div key={record._id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0"
                           style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}>
                            {getInitials(record.user?.name || 'A')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-surface-900 truncate" >{record.user?.name}</p>
                              <span className={`badge ${ROLE_COLORS[record.user?.role] || ROLE_COLORS.team_member}`}>{record.user?.role}</span>
                              <span className={`badge ${status.className}`}>{status.label}</span>
                              {record.isLate && <span className="badge bg-amber-100 text-amber-700">Late {record.lateMinutes ? `(${formatMinutesAsHours(record.lateMinutes)})` : ''}</span>}
                              {record.isHalfDay && <span className="badge bg-blue-100 text-blue-700">Half Day</span>}
                              {record.status === 'pending' && record.lateReason && (
                                <span className="text-xs text-orange-600">Reason: {record.lateReason}</span>
                              )}
                              {record.lateApprovalStatus === 'approved' && record.lateReviewedBy && (
                                <span className="text-xs text-emerald-600">
                                  Approved by {record.lateReviewedBy.name} ({record.lateReviewedBy.role})
                                </span>
                              )}
                              {record.lateApprovalStatus === 'rejected' && record.lateReviewedBy && (
                                <span className="text-xs text-rose-600">
                                  Rejected by {record.lateReviewedBy.name} ({record.lateReviewedBy.role})
                                </span>
                              )}
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
                            <p className="text-sm font-semibold text-surface-900">{getWorkedMinutes(record) ? formatWorkedDuration(getWorkedMinutes(record)) : '—'}</p>
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