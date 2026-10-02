'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { IconAttendance, IconTeam } from '@/components/ui/Icons';
import { attendanceAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'half_day', label: 'Half Day Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatLeaveType(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
function formatStatus(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
function statusBadge(status) {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-700';
  return 'bg-orange-100 text-orange-700';
}

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const elevated = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [leaveRequestModal, setLeaveRequestModal] = useState({ open: false, leaveType: 'annual', startDate: '', endDate: '', reason: '' });
  const [leaveRequestSent, setLeaveRequestSent] = useState(false);
  const [leaveRequestEmails, setLeaveRequestEmails] = useState([]);
  const [leaveDetailModal, setLeaveDetailModal] = useState({ open: false, leave: null, reviewNote: '' });
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.getLeaves({ limit: 200, ...(statusFilter ? { status: statusFilter } : {}) });
      setLeaves(res.data.leaves || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => ({
    total: leaves.length,
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  }), [leaves]);

  const visibleLeaves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...leaves]
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || new Date(b.createdAt) - new Date(a.createdAt))
      .filter((leave) => {
        if (!q) return true;
        return [leave.user?.name, leave.user?.email, leave.user?.role, leave.leaveType, leave.reason]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      });
  }, [leaves, search]);

  const myLeaves = useMemo(
    () => [...leaves].filter((l) => String(l.user?._id) === String(user?.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [leaves, user?.id]
  );

  const openLeaveRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setLeaveRequestModal({ open: true, leaveType: 'annual', startDate: today, endDate: today, reason: '' });
    setLeaveRequestSent(false);
    setLeaveRequestEmails([]);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveRequestModal.startDate || !leaveRequestModal.endDate) return toast.error('Please select start and end dates');
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
      toast.success('Leave request submitted successfully! Email notification sent to HR.');
      await fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelLeaveRequest = async (leaveId) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    setSaving(true);
    try {
      await attendanceAPI.cancelLeaveRequest(leaveId);
      toast.success('Leave request cancelled successfully!');
      if (leaveDetailModal.leave?._id === leaveId) setLeaveDetailModal({ open: false, leave: null, reviewNote: '' });
      await fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewLeave = async (id, status, note) => {
    try {
      setSaving(true);
      const result = await attendanceAPI.reviewLeave(id, { status, reviewNote: note });
      if (result.data.success) {
        toast.success(`Leave request ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
        await fetchLeaves();
        setLeaveDetailModal({ open: false, leave: null, reviewNote: '' });
        setShowRejectModal(false);
      } else {
        toast.error(result.data.message || 'Failed to review leave request');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review leave request');
    } finally {
      setSaving(false);
    }
  };

  const submitRejection = () => {
    if (leaveDetailModal.leave && leaveDetailModal.reviewNote.trim()) {
      handleReviewLeave(leaveDetailModal.leave._id, 'rejected', leaveDetailModal.reviewNote);
      setShowRejectModal(false);
    } else {
      toast.error('Please provide a rejection reason');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Requests"
        subtitle="All leave data lives here — opened from the On Leave card"
        action={
          <div className="flex items-center gap-2">
            <Link href="/attendance" className="btn-secondary">Back to Attendance</Link>
            {!['admin', 'super_admin'].includes(user?.role) && (
              <button type="button" onClick={openLeaveRequestModal} disabled={saving} className="btn-primary">Request Leave</button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={counts.total} icon={IconAttendance} accent="primary" />
        <StatCard label="Pending" value={counts.pending} icon={IconTeam} accent="amber" />
        <StatCard label="Approved" value={counts.approved} icon={IconTeam} accent="green" />
        <StatCard label="Rejected" value={counts.rejected} icon={IconTeam} accent="rose" />
      </div>
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (<option key={o.value || 'all'} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <input className="input" placeholder="Search employee, email, type, reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-surface-500">Loading leave requests...</div>
      ) : (
        <>
          <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <h3 className="text-lg font-semibold text-surface-900 mb-1">Your Leave Requests</h3>
            <p className="text-xs text-surface-500 mb-3">Approved / rejected status, reviewer name, date and reason appear here. Click a card for full details.</p>
            {myLeaves.length > 0 ? (
              <div className="space-y-2">
                {myLeaves.map((leave) => (
                  <div key={leave._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-surface-200 gap-3">
                    <button type="button" className="flex-1 text-left cursor-pointer group" onClick={() => setLeaveDetailModal({ open: true, leave, reviewNote: '' })}>
                      <p className="font-medium text-surface-900 group-hover:text-blue-700 group-hover:underline">{formatLeaveType(leave.leaveType)}</p>
                      <p className="text-sm text-surface-500">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                      <p className="text-xs text-surface-400">{leave.totalDays} day(s) • Reviewed info in details</p>
                    </button>
                    {leave.status === 'pending' && String(leave.user?._id) === String(user?.id) && (
                      <button onClick={() => handleCancelLeaveRequest(leave._id)} disabled={saving} className="btn-secondary text-sm py-1 px-3">Cancel</button>
                    )}
                    {leave.status !== 'pending' && (
                      <span className={`badge text-xs px-2 py-0.5 shrink-0 ${statusBadge(leave.status)}`}>{formatStatus(leave.status)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (<p className="text-sm text-surface-400">No leave requests found for your account.</p>)}
          </div>

          {elevated && (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <h3 className="text-lg font-semibold text-surface-900 mb-1">Leave Requests Management</h3>
              <p className="text-xs text-surface-500 mb-3">Click on employee name to view details and approve/reject leave requests.</p>
              {visibleLeaves.length > 0 ? (
                <div className="space-y-3">
                  {visibleLeaves.map((leave) => (
                    <div key={leave._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-surface-200 gap-3">
                      <button type="button" className="flex-1 text-left cursor-pointer group" onClick={() => setLeaveDetailModal({ open: true, leave, reviewNote: '' })}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-blue-600 group-hover:underline">{leave.user?.name || 'N/A'}</p>
                          <span className="text-xs text-surface-500">({leave.user?.role || 'N/A'})</span>
                          <span className={`badge text-xs px-2 py-0.5 ${statusBadge(leave.status)}`}>{formatStatus(leave.status)}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-surface-500">
                          <span className="text-surface-700 font-medium">{formatLeaveType(leave.leaveType)}</span>
                          <span>{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</span>
                          <span>{leave.totalDays} day(s)</span>
                        </div>
                      </button>
                      {leave.status === 'pending' && (
                        <button type="button" className="btn-secondary text-sm" onClick={() => setLeaveDetailModal({ open: true, leave, reviewNote: '' })}>Review</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (<p className="text-sm text-surface-400">No leave requests found.</p>)}
            </div>
          )}
        </>
      )}

      {leaveDetailModal.open && leaveDetailModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-surface-900">Leave Request Details</h3>
              <button onClick={() => setLeaveDetailModal({ open: false, leave: null, reviewNote: '' })} className="text-surface-400 hover:text-surface-600">X</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-4 items-center">
                <p className="text-sm text-surface-500">Employee:</p>
                <p className="font-medium text-surface-900">{leaveDetailModal.leave.user?.name || 'N/A'}</p>
                <span className="text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded">{leaveDetailModal.leave.user?.role || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-surface-400">Leave Type</p><p className="font-medium">{formatLeaveType(leaveDetailModal.leave.leaveType)}</p></div>
                <div><p className="text-xs text-surface-400">Status</p><span className={`badge text-xs px-2 py-0.5 ${statusBadge(leaveDetailModal.leave.status)}`}>{formatStatus(leaveDetailModal.leave.status)}</span></div>
                <div><p className="text-xs text-surface-400">Start Date</p><p className="font-medium">{new Date(leaveDetailModal.leave.startDate).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-surface-400">End Date</p><p className="font-medium">{new Date(leaveDetailModal.leave.endDate).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-surface-400">Total Days</p><p className="font-medium">{leaveDetailModal.leave.totalDays} day(s)</p></div>
                <div><p className="text-xs text-surface-400">Submitted At</p><p className="font-medium">{new Date(leaveDetailModal.leave.createdAt).toLocaleString()}</p></div>
              </div>
              {leaveDetailModal.leave.reason && (
                <div><p className="text-xs text-surface-400">Reason for Leave</p><div className="bg-surface-50 rounded-lg p-3 text-sm">{leaveDetailModal.leave.reason}</div></div>
              )}
              {leaveDetailModal.leave.reviewedAt && (
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-xs text-surface-400">Review Information</p>
                  <div className="mt-1 text-sm">
                    <p><strong>Reviewed By:</strong> {leaveDetailModal.leave.reviewedBy?.name || 'N/A'}</p>
                    <p><strong>Reviewed At:</strong> {new Date(leaveDetailModal.leave.reviewedAt).toLocaleString()}</p>
                    {leaveDetailModal.leave.reviewNote && (<p><strong>Review Note:</strong> {leaveDetailModal.leave.reviewNote}</p>)}
                  </div>
                </div>
              )}
            </div>
            {leaveDetailModal.leave.status === 'pending' && ['super_admin', 'admin', 'hr'].includes(user?.role) && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-surface-200">
                <button onClick={() => handleReviewLeave(leaveDetailModal.leave._id, 'approved', '')} disabled={saving} className="btn-primary flex-1">{saving ? 'Processing...' : 'Approve'}</button>
                <button onClick={() => setShowRejectModal(true)} disabled={saving} className="btn-secondary flex-1">Reject (with reason)</button>
              </div>
            )}
            {leaveDetailModal.leave.status !== 'pending' && (
              <div className="mt-4 pt-4 border-t border-surface-200">
                <button onClick={() => setLeaveDetailModal({ open: false, leave: null, reviewNote: '' })} className="btn-secondary w-full">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-surface-900">Reject Leave Request</h3>
            <textarea className="input min-h-[110px] w-full" placeholder="Enter rejection reason..." value={leaveDetailModal.reviewNote} onChange={(e) => setLeaveDetailModal((prev) => ({ ...prev, reviewNote: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitRejection} disabled={saving} className="btn-primary flex-1">{saving ? 'Processing...' : 'Send Rejection'}</button>
            </div>
          </div>
        </div>
      )}

      {leaveRequestModal.open && !leaveRequestSent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleApplyLeave} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div><h3 className="text-lg font-semibold text-surface-900">Request Leave</h3><p className="text-sm text-surface-500 mt-1">Submit a leave request with email notification to HR.</p></div>
            <div>
              <label className="label">Leave Type</label>
              <select className="input" value={leaveRequestModal.leaveType} onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, leaveType: e.target.value, endDate: e.target.value === 'half_day' ? prev.startDate : prev.endDate }))}>
                {LEAVE_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Date</label><input type="date" className="input" value={leaveRequestModal.startDate} onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, startDate: e.target.value }))} /></div>
              <div><label className="label">End Date</label><input type="date" className="input" value={leaveRequestModal.endDate} min={leaveRequestModal.startDate || undefined} disabled={leaveRequestModal.leaveType === 'half_day'} onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, endDate: e.target.value }))} /></div>
            </div>
            <div><label className="label">Reason (optional)</label><textarea className="input min-h-[100px]" value={leaveRequestModal.reason} onChange={(e) => setLeaveRequestModal((prev) => ({ ...prev, reason: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLeaveRequestModal((prev) => ({ ...prev, open: false }))}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      )}

      {leaveRequestModal.open && leaveRequestSent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <h3 className="text-lg font-semibold text-surface-900">Leave Request Submitted!</h3>
            <p className="text-sm text-surface-500 mt-1">Email notifications have been sent to HR.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="btn-primary" onClick={() => { setLeaveRequestModal({ open: false, leaveType: 'annual', startDate: '', endDate: '', reason: '' }); setLeaveRequestEmails([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

